import sys
import os
import time
import json
import urllib.request
import urllib.error
import subprocess
import threading
from PIL import Image, ImageDraw
import pystray
from plyer import notification

ZHERKEYS_SITE_URL = os.environ.get('ZHERKEYS_SITE_URL', 'https://zherkeys.com')
BOT_API_SECRET = os.environ.get('BOT_API_SECRET', 'zherkeys-secret-bot-token-2026')
POLL_INTERVAL_SEC = 5
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Global State
current_status = 'green'  # 'green', 'yellow', 'red'
status_text = 'Zher Keys Bot - Status: OK (Ativo)'
icon_instance = None
notified_orders = set()

def create_badge_icon(color_name):
    """Gera um ícone de alta qualidade para a bandeja do sistema (System Tray)"""
    img = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Fundo circular escuro estilo ZherKeys (Slate-950)
    draw.ellipse((2, 2, 62, 62), fill=(15, 23, 42, 255), outline=(51, 65, 85, 255), width=3)
    
    color_map = {
        'green': (34, 197, 94, 255),    # 🟢 Verde Esmeralda (OK / Ativo)
        'yellow': (234, 179, 8, 255),   # 🟡 Amarelo Âmbar (Pendência / Processando)
        'red': (239, 68, 68, 255)       # 🔴 Vermelho (Erro)
    }
    fill_color = color_map.get(color_name, color_map['green'])
    
    # Esfera central de status com efeito de iluminação
    draw.ellipse((14, 14, 50, 50), fill=fill_color)
    draw.ellipse((20, 20, 36, 36), fill=(255, 255, 255, 70))  # Brilho de destaque
    
    return img

def send_pc_notification(title, message, is_error=False):
    """Envia uma notificação nativa do Windows no canto da tela (perto da hora)"""
    try:
        app_icon = None
        icon_path = os.path.join(BASE_DIR, 'public', 'favicon.ico')
        if os.path.exists(icon_path):
            app_icon = icon_path

        notification.notify(
            title=title,
            message=message,
            app_name='Zher Keys Bot',
            app_icon=app_icon,
            timeout=8
        )
    except Exception as e:
        print(f"[NOTIF-ERROR] Falha ao enviar notificação: {e}")

def update_tray_status(status, text):
    global current_status, status_text, icon_instance
    current_status = status
    status_text = text
    if icon_instance:
        icon_instance.icon = create_badge_icon(status)
        icon_instance.title = text

def fetch_pending_orders():
    url = f"{ZHERKEYS_SITE_URL}/api/bot/pending-orders"
    req = urllib.request.Request(url, headers={'x-bot-token': BOT_API_SECRET})
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status == 200:
                data = json.loads(response.read().decode('utf-8'))
                return data.get('pendingOrders', [])
    except Exception as e:
        print(f"[POLL-ERROR] Erro ao conectar ao servidor ZherKeys: {e}")
    return None

def open_screenshots_folder(icon, item):
    folder = os.path.join(BASE_DIR, 'logs', 'screenshots')
    if not os.path.exists(folder):
        os.makedirs(folder, exist_ok=True)
    os.startfile(folder)

def open_log_file(icon, item):
    log_path = os.path.join(BASE_DIR, 'logs', 'eneba_bot.log')
    if os.path.exists(log_path):
        os.startfile(log_path)
    else:
        send_pc_notification("Zher Keys Bot", "Nenhum arquivo de log gerado ainda.")

def force_check_now(icon, item):
    threading.Thread(target=bot_loop_cycle, daemon=True).start()

def exit_bot(icon, item):
    icon.stop()
    os._exit(0)

def bot_loop_cycle():
    global notified_orders
    orders = fetch_pending_orders()
    
    if orders is None:
        update_tray_status('green', 'Zher Keys Bot - Conectando ao Servidor...')
        return

    if len(orders) == 0:
        update_tray_status('green', 'Zher Keys Bot - Status: OK (0 Pedidos Pendentes)')
    else:
        # 🟡 Existem pedidos pendentes!
        order = orders[0]
        order_id = order.get('order_id')
        title = order.get('title', 'Produto')
        
        update_tray_status('yellow', f'Zher Keys Bot - Processando Pedido #{order_id} ({title})')
        
        if order_id not in notified_orders:
            notified_orders.add(order_id)
            send_pc_notification(
                "🎮 NOVO PEDIDO RECEBIDO!",
                f"Pedido #{order_id} - {title}\nIniciando resgate de chave na Eneba..."
            )
        
        print(f"\n⚡ [TRAY-AGENT] Executando resgate para o Pedido #{order_id} ({title})...")
        
        # Executa o robô Node.js para realizar a compra
        try:
            node_script = os.path.join(BASE_DIR, 'zherkeys_pc_bot_agent.js')
            result = subprocess.run(['node', node_script, '--single-run'], capture_output=True, text=True, timeout=120)
            
            if "SUCESSO" in result.stdout or "atualizado pelo Robô Local" in result.stdout or "Key resgatada" in result.stdout:
                update_tray_status('green', f'Zher Keys Bot - Pedido #{order_id} Entregue!')
                send_pc_notification(
                    "🎉 CHAVE ENTREGUE COM SUCESSO!",
                    f"Pedido #{order_id} ({title})\nA chave foi enviada ao cliente!"
                )
            else:
                # 🔴 Algo falhou durante o resgate
                update_tray_status('red', f'Zher Keys Bot - Erro no Pedido #{order_id}')
                send_pc_notification(
                    "❌ ERRO AO RESGATAR CHAVE",
                    f"Pedido #{order_id} ({title})\nVerifique as screenshots em logs/screenshots/",
                    is_error=True
                )
        except Exception as err:
            update_tray_status('red', f'Zher Keys Bot - Erro no Pedido #{order_id}')
            send_pc_notification(
                "❌ ALERTA DE ERRO",
                f"Falha ao executar o robô para o Pedido #{order_id}: {err}",
                is_error=True
            )

def main_loop():
    while True:
        try:
            bot_loop_cycle()
        except Exception as e:
            print(f"[MAIN-LOOP-ERROR] {e}")
        time.sleep(POLL_INTERVAL_SEC)

def setup_tray_icon():
    global icon_instance
    icon_image = create_badge_icon('green')
    
    menu = pystray.Menu(
        pystray.MenuItem('🟢 Status: OK (Monitorando)', lambda: None, enabled=False),
        pystray.MenuItem('🔄 Verificar Pedidos Agora', force_check_now),
        pystray.MenuItem('📸 Abrir Pasta de Screenshots', open_screenshots_folder),
        pystray.MenuItem('📝 Ver Arquivo de Log', open_log_file),
        pystray.MenuItem('🚪 Sair do Robô', exit_bot)
    )
    
    icon_instance = pystray.Icon("ZherKeysBot", icon_image, "Zher Keys Bot - Status: OK (Ativo)", menu)
    
    # Inicia a thread de monitoramento em segundo plano
    monitor_thread = threading.Thread(target=main_loop, daemon=True)
    monitor_thread.start()
    
    send_pc_notification(
        "🚀 ZHER KEYS ROBÔ ATIVADO!",
        "O robô está ativo no canto da tela (setinha ao lado da hora)."
    )
    
    icon_instance.run()

if __name__ == '__main__':
    setup_tray_icon()

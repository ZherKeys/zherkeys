// Auto-generated Zher Keys Academy Courses Catalog & Classroom Data
window.ZHER_COURSES_DATA = [
  {
    "id": 101,
    "slug": "curso-otimizacao-fps-pc-gamer",
    "title": "Curso & Guia PDF: Otimização Extrema de PC Gamer & Windows 11/10 (+FPS e Zero Input Lag)",
    "shortTitle": "Otimizacao Extrema de PC Gamer & FPS Boost",
    "category": "CURSO & GUIA PDF",
    "categoryFilter": "hardware",
    "categoryLabel": "Hardware & Desempenho",
    "price": 19.9,
    "old_price": 69.9,
    "workload": "14 Horas (Vídeo + Apostila PDF)",
    "pdfPages": 48,
    "level": "Iniciante ao Avançado",
    "rating": 4.9,
    "studentsCount": 1420,
    "pdfUrl": "/pdfs/curso-otimizacao-fps-pc-gamer.pdf",
    "image": "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?q=80&w=1200&auto=format&fit=crop",
    "genres": "Curso, Guia PDF, Videoaulas, Hardware, Otimização, FPS, Educativo",
    "summary": "Aprenda passo a passo como extrair até +45% de FPS do seu PC Gamer ou Notebook sem gastar nada em peças. Inclui Guia Técnico Completo em PDF com scripts de otimização, ajustes profundos no Registro do Windows 10/11, configuração de Painel NVIDIA/AMD, DLSS/FSR, redução de Input Lag e videoaulas práticas.",
    "lessons": [
      {
        "number": 1,
        "title": "Como Otimizar e Configurar o Windows por Completo para Mais FPS e Desempenho",
        "duration": "22:15",
        "youtubeId": "drRP_poclL0",
        "channel": "iGust",
        "summary": "Configuração completa do sistema operacional Windows do zero, desativando telemetria, serviços em segundo plano e otimizando o agendador de GPU."
      },
      {
        "number": 2,
        "title": "Otimização Avançada do Windows para Mais Performance e Menos Input Lag",
        "duration": "18:40",
        "youtubeId": "_0TWsQzAvTA",
        "channel": "HSRoficial",
        "summary": "Ajustes de latência de sistema, plano de energia Desempenho Máximo, temporizadores de alta precisão (HPET) e resposta de periféricos."
      },
      {
        "number": 3,
        "title": "Como Aumentar o FPS em Jogos em PC Fraco ou Intermediário (Guia Prático)",
        "duration": "14:20",
        "youtubeId": "JGUib1OPXZc",
        "channel": "EuCardoso - Tutoriais",
        "summary": "Técnicas de otimização de memória RAM, memória virtual (Pagefile), limpeza de cache DirectX e ajustes gráficos inteligentes."
      },
      {
        "number": 4,
        "title": "Segredos Rápidos de Hardware e Software para Ganhar Mais FPS Imediatamente",
        "duration": "11:05",
        "youtubeId": "B7nKwUs3VKo",
        "channel": "TecnoGeek",
        "summary": "Checklist rápido de drivers, Modo de Jogo do Windows, HAGS (Agendamento de GPU Acelerado por Hardware) e perfil XMP."
      },
      {
        "number": 5,
        "title": "Otimização de Jogos Pesados em PCs Modestos: Resolução, Upscaling e Tweaks",
        "duration": "15:50",
        "youtubeId": "pUrn5p1bP7M",
        "channel": "EuCardoso - Tutoriais",
        "summary": "Como combinar escalonamento de imagem (NIS, FSR, DLSS) e parâmetros de inicialização na Steam/Epic para dobrar a taxa de quadros."
      }
    ],
    "modules": [
      {
        "number": 1,
        "title": "Preparação do Sistema, Limpeza de Telemetria e Serviços do Windows",
        "paragraphs": [
          "O Windows 10 e o Windows 11 vêm configurados de fábrica para atender ambientes corporativos e tablets, carregando mais de 80 processos simultâneos que disputam ciclos de CPU (Thread Scheduling) e largura de banda da memória RAM durante seus jogos.",
          "O primeiro passo de uma otimização profissional consiste em criar um Ponto de Restauração seguro e desativar a telemetria pesada, aplicativos em segundo plano (Background Apps), indexação contínua em unidades SSD NVMe e sobreposições desnecessárias (Xbox Game Bar DVR).",
          "Ao liberar o processador de interrupções constantes (DPC Latency), você elimina os famosos engasgos (micro-stuttering) e eleva imediatamente o 1% Low FPS, que é a métrica responsável pela sensação real de fluidez na tela."
        ],
        "checklist": [
          "Pressione Win + R, digite sysdm.cpl > Avançado > Desempenho > Ajustar para obter um melhor desempenho (mantenha apenas \"Mostrar miniaturas\" e \"Usar fontes de tela com cantos arredondados\").",
          "Em Configurações > Jogos > Modo de Jogo: ATIVE o Modo de Jogo, mas DESATIVE a gravação em segundo plano do Xbox Game DVR.",
          "Em Configurações > Sistema > Tela > Elementos Gráficos: Ative o \"Agendamento de GPU acelerado por hardware\" (HAGS) em placas RTX/RX modernas.",
          "Execute o comando powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61 no CMD (Admin) para desbloquear o plano de energia \"Desempenho Máximo\"."
        ]
      },
      {
        "number": 2,
        "title": "Painel de Controle NVIDIA / AMD Adrenalin e Limpeza DDU",
        "paragraphs": [
          "Atualizar drivers por cima de versões antigas acumula chaves órfãs no registro e caches de shaders corrompidos. Para máxima estabilidade, utilize o Display Driver Uninstaller (DDU) em Modo de Segurança antes de instalar o driver limpo.",
          "No Painel de Controle da NVIDIA (ou AMD Software: Adrenalin Edition), a configuração padrão prioriza economia de energia em vez de tempo de quadro (Frame Pacing) consistente. Ajustar o Modo de Gerenciamento de Energia para \"Preferir Desempenho Máximo\" impede que a GPU reduza seu clock em cenas leves.",
          "Além disso, ativar o Modo de Baixa Latência (NVIDIA Reflex / Ultra Low Latency ou AMD Anti-Lag) sincroniza a fila de quadros da CPU exatamente com a velocidade de renderização da GPU, reduzindo o Input Lag em até 35%."
        ],
        "checklist": [
          "Painel NVIDIA > Filtragem da Textura - Qualidade: Altere para \"Alto Desempenho\".",
          "Modo de Gerenciamento de Energia: Altere para \"Preferência por Desempenho Máximo\".",
          "Modo de Baixa Latência (Low Latency Mode): Ative em \"On\" ou \"Ultra\" (ou use NVIDIA Reflex dentro do jogo).",
          "Tamanho do Cache de Sombreamento (Shader Cache Size): Defina para \"10 GB\" ou \"Ilimitado\" para evitar travamentos ao carregar mapas."
        ]
      },
      {
        "number": 3,
        "title": "Memória RAM, Latência XMP/EXPO e Gerenciamento de Standby List",
        "paragraphs": [
          "Muitos jogadores compram memórias DDR4 de 3200MHz ou DDR5 de 6000MHz, mas esquecem de ativar o perfil XMP (Intel) ou EXPO/DOCP (AMD) na BIOS, fazendo com que a memória opere na velocidade básica JEDEC (2133MHz ou 4800MHz), o que reduz o FPS em até 25% em jogos competitivos.",
          "Outro problema crítico do Windows é o acúmulo de \"Memória em Espera\" (Standby Memory). Quando a memória em cache enche toda a RAM física, o sistema começa a paginar dados durante partidas intensas, gerando travadas bruscas.",
          "Com o utilitário Intelligent Standby List Cleaner (ISLC) ou tarefas agendadas de limpeza de Working Set, você garante memória livre contínua e latência mínima de acesso."
        ],
        "checklist": [
          "Entre na BIOS (tecla Del ou F2 ao ligar) e ative o perfil XMP / DOCP / EXPO das memórias RAM.",
          "Verifique no Gerenciador de Tarefas > Desempenho > Memória se os módulos estão operando em Dual Channel (2 de 2 ou 2 de 4 slots intercalados: A2 e B2).",
          "Configure o Arquivo de Paginação (Memória Virtual) no SSD mais rápido com tamanho inicial de 4096 MB e máximo de 16384 MB.",
          "Limpe a pasta %temp%, temp e prefetch semanalmente para evitar fragmentação de caches."
        ]
      },
      {
        "number": 4,
        "title": "Domínio de DLSS, FSR, XeSS e Parâmetros de Inicialização na Steam",
        "paragraphs": [
          "As tecnologias modernas de reconstrução de imagem baseadas em IA (NVIDIA DLSS, AMD FSR e Intel XeSS) permitem renderizar o jogo internamente em uma resolução menor (como 1080p) e reconstruir a imagem em 1440p ou 4K com nitidez quase idêntica à nativa e ganho de 40% a 80% de FPS.",
          "Para jogos competitivos de tiro (CS2, Valorant, Call of Duty, Apex Legends), o segredo está em reduzir sombras dinâmicas, oclusão de ambiente e reflexos volumétricos para o mínimo, mantendo apenas a distância de visão e a filtragem anisotrópica em 8x ou 16x.",
          "Utilize opções de inicialização limpas na Steam e desative sobreposições conflitantes (Discord Overlay + GeForce Experience + Steam Overlay simultâneos) para garantir estabilidade absoluta."
        ],
        "checklist": [
          "Use DLSS/FSR no modo \"Qualidade\" para 1080p/1440p e \"Equilibrado\" para 4K.",
          "Desative V-Sync em jogos competitivos ou combine G-Sync/FreeSync + V-Sync no driver com limitador de FPS 3 quadros abaixo da taxa do monitor (ex: 141 FPS em monitor 144Hz).",
          "Em Rede: Altere o DNS para Cloudflare (1.1.1.1 / 1.0.0.1) ou Google (8.8.8.8) e desative o \"Interrupt Moderation\" nas propriedades avançadas da placa de rede Ethernet."
        ]
      }
    ]
  },
  {
    "id": 102,
    "slug": "curso-montagem-hardware-pc-gamer",
    "title": "Curso & Guia PDF: Montagem de PC Gamer, Hardware e Upgrade Sem Gargalo (Do Zero ao 4K)",
    "shortTitle": "Montagem de PC Gamer & Hardware Sem Gargalo",
    "category": "CURSO & GUIA PDF",
    "categoryFilter": "hardware",
    "categoryLabel": "Hardware & Montagem",
    "price": 24.9,
    "old_price": 89.9,
    "workload": "18 Horas (Vídeo + Apostila PDF)",
    "pdfPages": 56,
    "level": "Iniciante ao Profissional",
    "rating": 5,
    "studentsCount": 1180,
    "pdfUrl": "/pdfs/curso-montagem-hardware-pc-gamer.pdf",
    "image": "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?q=80&w=1200&auto=format&fit=crop",
    "genres": "Curso, Guia PDF, Videoaulas, Hardware, Montagem PC, Educativo",
    "summary": "O guia definitivo para escolher peças com o melhor custo-benefício, evitar gargalos (bottleneck) entre Processador e Placa de Vídeo, montar seu computador do absoluto zero com segurança total, organizar cabos e configurar a BIOS na primeira inicialização.",
    "lessons": [
      {
        "number": 1,
        "title": "Como Montar um PC Gamer Passo a Passo - Tutorial Completo e Detalhado",
        "duration": "34:12",
        "youtubeId": "bW08y0gJqbY",
        "channel": "TecnoArt",
        "summary": "Aula prática completa mostrando a instalação do processador, cooler, memória RAM, SSD NVMe, fonte, gabinete e placa de vídeo."
      },
      {
        "number": 2,
        "title": "Como Montar seu PC Gamer Sem Saber Nada (Passo a Passo para Iniciantes)",
        "duration": "26:45",
        "youtubeId": "IqaXt6Visjg",
        "channel": "LipeTech",
        "summary": "Explicação didática de cada conector da placa-mãe, painel frontal (Power SW, Reset, LED), cabos PCIe e alimentação EPS da CPU."
      },
      {
        "number": 3,
        "title": "Guia Completo de Como Escolher e Montar um PC Gamer Equilibrado",
        "duration": "19:30",
        "youtubeId": "Mqg8lPMW2jo",
        "channel": "techgus",
        "summary": "Como dimensionar a fonte de alimentação (Watts e Selo 80 Plus), escolher a placa-mãe ideal (VRM) e combinar CPU + GPU sem gargalo."
      },
      {
        "number": 4,
        "title": "Tudo que Você Precisa Saber Antes de Comprar e Montar um PC",
        "duration": "15:18",
        "youtubeId": "ZhNiLJsXmMc",
        "channel": "Cortes do PoisonStp",
        "summary": "Erros clássicos que iniciantes cometem ao comprar peças e como economizar centenas de reais escolhendo componentes certos."
      },
      {
        "number": 5,
        "title": "Montagem Prática Rápida do Zero ao Primeiro Boot",
        "duration": "08:50",
        "youtubeId": "GOQ0Yren4V0",
        "channel": "Italo Canella",
        "summary": "Visão geral dinâmica da bancada, encaixes seguros e checklist visual antes de apertar o botão Power pela primeira vez."
      }
    ],
    "modules": [
      {
        "number": 1,
        "title": "Arquitetura de um PC Gamer e Como Evitar Gargalos (Bottleneck)",
        "paragraphs": [
          "Um PC Gamer de alto desempenho funciona como uma orquestra: não adianta investir todo o orçamento em uma Placa de Vídeo topo de linha se o Processador (CPU) não conseguir entregar os quadros a tempo, ou se a Fonte de Alimentação não tiver estabilidade nas linhas de 12V.",
          "Para resoluções 1080p (Full HD) com foco competitivo (144Hz a 240Hz), o Processador e a velocidade da memória RAM são extremamente exigidos. Já em 1440p (Quad HD) e 4K, a carga recai quase 90% sobre a Placa de Vídeo (GPU) e sua quantidade de VRAM (mínimo recomendado hoje: 8GB a 12GB para 1080p/1440p e 16GB para 4K).",
          "A regra de ouro de orçamento equilibrado destina cerca de 40% a 45% do valor total do PC para a Placa de Vídeo, 20% a 25% para o Processador, e o restante distribuído entre Placa-Mãe com bom VRM, 16GB ou 32GB de RAM em Dual Channel, SSD NVMe PCIe 4.0 e Fonte certificada."
        ],
        "checklist": [
          "Verifique a compatibilidade do Soquete: AMD AM4 (Ryzen série 3000/5000), AMD AM5 (Ryzen série 7000/9000 - exige DDR5) ou Intel LGA1700/1851.",
          "Sempre utilize 2 pentes de memória RAM (ex: 2x8GB ou 2x16GB) para ativar o Dual Channel e dobrar a largura de banda.",
          "Escolha fontes com PFC Ativo, certificação 80 Plus Bronze/Gold e aprovação em testes de ripple (ex: Cybenetics / TecLab)."
        ]
      },
      {
        "number": 2,
        "title": "Preparação da Bancada e Instalação na Placa-Mãe (Fora do Gabinete)",
        "paragraphs": [
          "O segredo dos técnicos profissionais é montar o kit principal (Processador + Memória RAM + SSD M.2 + Air Cooler) na placa-mãe apoiada sobre a própria caixa de papelão da placa-mãe antes de colocá-la dentro do gabinete.",
          "Ao instalar o processador, nunca force os pinos: alinhe o triângulo dourado do canto do processador com a marcação do soquete da placa-mãe. Ele deve encaixar apenas com o próprio peso (Zero Insertion Force).",
          "Em seguida, instale o SSD NVMe no slot M.2 mais próximo do processador (que possui comunicação direta com as linhas PCIe da CPU) e encaixe as memórias RAM nos slots principais indicados no manual (geralmente A2 e B2, o 2º e o 4º slot)."
        ],
        "checklist": [
          "ATENÇÃO CRÍTICA: Remova o adesivo plástico de proteção da base de cobre do Cooler/Watercooler antes de encostá-lo no processador!",
          "Aplique uma gota central (tamanho de uma ervilha) ou um \"X\" fino de pasta térmica de alta condutividade no centro do IHS do processador.",
          "Aperte os parafusos do cooler em padrão cruzado (diagonal) para espalhar a pressão uniformemente."
        ]
      },
      {
        "number": 3,
        "title": "Gabinete, Espelho Traseiro, Fonte e Conexões do Painel Frontal",
        "paragraphs": [
          "Antes de parafusar a placa-mãe no gabinete, instale o espelho traseiro (I/O Shield, caso não seja integrado) e confira se os espaçadores metálicos (standoffs) do gabinete coincidem exatamente com os furos da sua placa-mãe (ATX, Micro-ATX ou Mini-ITX). Um espaçador no lugar errado pode causar curto-circuito atrás da placa.",
          "Posicione a fonte de alimentação com a ventoinha voltada para baixo (onde há o filtro de poeira inferior do gabinete), garantindo um fluxo de ar independente para a fonte.",
          "Conecte os cabos de energia principais até ouvir o clique da trava: o cabo ATX de 24 pinos na lateral direita da placa-mãe e o cabo EPS de 4+4 pinos (CPU) no canto superior esquerdo."
        ],
        "checklist": [
          "Nunca confunda o cabo EPS 4+4 pinos (escrito CPU) com o cabo PCIe 6+2 pinos (escrito PCI-E para a placa de vídeo).",
          "Conecte os pequenos cabos do Painel Frontal (JFP1 / F_PANEL): Power SW, Reset SW, HDD LED e Power LED seguindo o diagrama impresso na placa-mãe.",
          "Conecte o cabo USB 3.0 frontal, USB-C (se houver) e o cabo HD_AUDIO no canto inferior esquerdo da placa-mãe."
        ]
      },
      {
        "number": 4,
        "title": "Instalação da Placa de Vídeo, Primeiro Boot, BIOS e Windows",
        "paragraphs": [
          "A Placa de Vídeo (GPU) deve ser o último componente a ser instalado. Remova as duas chapas metálicas traseiras do gabinete correspondentes ao primeiro slot PCIe x16, destrave a presilha do slot PCIe na placa-mãe e encaixe a placa de vídeo com firmeza.",
          "Parafuse a placa de vídeo no gabinete para que ela não envergue e conecte os cabos de energia PCIe (6+2 pinos ou 12VHPWR) vindos da fonte.",
          "Atenção: O cabo HDMI ou DisplayPort do seu monitor DEVE ser conectado diretamente nas saídas da Placa de Vídeo (horizontais, mais abaixo), e NÃO na placa-mãe!"
        ],
        "checklist": [
          "Conecte o cabo DisplayPort (recomendado para 144Hz+/G-Sync) diretamente na Placa de Vídeo.",
          "Ao ligar o PC, pressione DEL ou F2 para entrar na BIOS: ative o XMP/EXPO da memória RAM e o Resizable BAR (Re-Size BAR / Smart Access Memory).",
          "Instale o Windows 11/10 via Pendrive Bootável criado com a ferramenta oficial da Microsoft, instalando em seguida os drivers de Chipset e GPU."
        ]
      }
    ]
  },
  {
    "id": 103,
    "slug": "curso-criacao-desenvolvimento-jogos",
    "title": "Curso & Guia PDF: Criação e Desenvolvimento de Jogos 2D e 3D (Unity, Godot & Game Design)",
    "shortTitle": "Criacao e Desenvolvimento de Jogos 2D e 3D",
    "category": "CURSO & GUIA PDF",
    "categoryFilter": "dev",
    "categoryLabel": "Game Dev & Engines",
    "price": 29.9,
    "old_price": 119.9,
    "workload": "24 Horas (Vídeo + Apostila PDF)",
    "pdfPages": 64,
    "level": "Iniciante ao Intermediário",
    "rating": 4.9,
    "studentsCount": 950,
    "pdfUrl": "/pdfs/curso-criacao-desenvolvimento-jogos.pdf",
    "image": "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?q=80&w=1200&auto=format&fit=crop",
    "genres": "Curso, Guia PDF, Videoaulas, Desenvolvimento de Jogos, Programação, Educativo",
    "summary": "Descubra como transformar suas ideias em jogos reais 2D e 3D! Aprenda os fundamentos de Game Design, escolha a engine ideal (Godot 4, Unity ou Unreal Engine 5), programe movimentação, física, colisão, inteligência artificial de inimigos, interface de usuário e publique seu jogo na Steam e Itch.io.",
    "lessons": [
      {
        "number": 1,
        "title": "O Único Guia que Você Precisa para Começar a Criar Jogos do Zero",
        "duration": "21:10",
        "youtubeId": "YttotvHX_TU",
        "channel": "Lua Lúdica",
        "summary": "Roteiro completo de aprendizado para iniciantes no desenvolvimento de jogos: ferramentas gratuitas, lógica, arte, áudio e escopo."
      },
      {
        "number": 2,
        "title": "Os 3 Passos Fundamentais para Criar e Finalizar seu Primeiro Jogo",
        "duration": "12:45",
        "youtubeId": "gY3bUNnj6bo",
        "channel": "RodDev",
        "summary": "Como planejar mecânicas principais (Core Loop), prototipar rápido sem travar na parte artística e concluir projetos."
      },
      {
        "number": 3,
        "title": "Godot Engine vs Unity: Entenda o Ecossistema Atual de Game Engines",
        "duration": "14:30",
        "youtubeId": "4bsHCDtnmS8",
        "channel": "Spacelaxy",
        "summary": "Análise comparativa entre Godot Engine (código aberto e super leve) e Unity/Unreal para projetos indie 2D e 3D."
      },
      {
        "number": 4,
        "title": "Bastidores e Arquitetura de um Jogo FPS Estilizado na Godot Engine",
        "duration": "16:20",
        "youtubeId": "Yerl68tLGNA",
        "channel": "Sembask",
        "summary": "Estudo de caso prático de criação de cenários 3D, shaders estilizados, armas, movimentação e level design na prática."
      },
      {
        "number": 5,
        "title": "Primeiros Passos Rápidos Criando um Jogo 2D na Godot",
        "duration": "05:00",
        "youtubeId": "ENde5kN8-S4",
        "channel": "CorteBruto",
        "summary": "Demonstração prática da estrutura de Nós (Nodes), CharacterBody2D, CollisionShape e script básico de movimentação."
      }
    ],
    "modules": [
      {
        "number": 1,
        "title": "Fundamentos de Game Design, Core Loop e Escolha da Engine",
        "paragraphs": [
          "Todo grande jogo nasce de um \"Core Loop\" (Ciclo Principal de Gameplay): a sequência de ações que o jogador repete a cada 30 segundos (ex: Explorar -> Combater/Coletar -> Evoluir Personagem -> Enfrentar Desafio Maior). Antes de abrir qualquer código, defina seu GDD (Game Design Document) de 1 página.",
          "A escolha da Game Engine depende do seu objetivo: a Godot Engine 4 é hoje a melhor escolha leve, 100% gratuita e sem royalties para jogos 2D e 3D indie (usando GDScript, muito parecido com Python, ou C#).",
          "Já a Unity domina o mercado mobile e multiplataforma com C#, enquanto a Unreal Engine 5 (C++ e Blueprints visuais) é o padrão da indústria para gráficos 3D fotorrealistas com Nanite e Lumen."
        ],
        "checklist": [
          "Regra de Ouro do Primeiro Jogo: Comece pequeno! Recrie mecânicas clássicas (Plataforma 2D, Top-Down Shooter ou Roguelike de 1 tela) antes de tentar um MMORPG.",
          "Baixe a Godot Engine 4 (menos de 100MB, não requer instalação pesada) ou o Unity Hub.",
          "Separe sua pasta de projeto em: /scenes, /scripts, /sprites, /audio e /ui."
        ]
      },
      {
        "number": 2,
        "title": "O Game Loop (Process, Delta Time) e Física de Movimentação",
        "paragraphs": [
          "Um jogo nada mais é do que um loop infinito que roda 60 ou mais vezes por segundo: lê a entrada do jogador (Input), atualiza a lógica e a física (Update / Physics Process) e desenha a cena na tela (Render).",
          "Para que o seu personagem se mova na mesma velocidade tanto em um PC a 30 FPS quanto em um monitor de 240 FPS, toda velocidade deve ser multiplicada pelo \"delta\" (Delta Time — o tempo exato transcorrido entre o quadro anterior e o atual).",
          "Em jogos 2D e 3D, utilizamos corpos físicos especializados (como CharacterBody2D/3D na Godot ou CharacterController/Rigidbody na Unity) que calculam automaticamente deslizamento em rampas e resposta a colisões (move_and_slide)."
        ],
        "checklist": [
          "Sempre processe física e movimentação dentro do _physics_process(delta) (Godot) ou FixedUpdate() (Unity).",
          "Normalize vetores diagonais (input_vector.normalized()) para evitar que o personagem ande 41% mais rápido na diagonal!",
          "Implemente \"Coyote Time\" (permitir pular 0.1s após sair de uma borda) e \"Jump Buffering\" para deixar os controles responsivos e profissionais."
        ]
      },
      {
        "number": 3,
        "title": "Arte 2D/3D, Tilemaps, Animações, Shaders e Efeitos Sonoros (Game Feel)",
        "paragraphs": [
          "O que diferencia um jogo amador de um sucesso na Steam é o \"Game Feel\" (também chamado de \"Juice\"): o feedback visual e sonoro imediato para cada ação do jogador.",
          "Quando o jogador atinge um inimigo, combine 4 elementos em menos de 100 milissegundos: 1) Um leve tremor de câmera (Screen Shake); 2) Um flash branco no sprite do inimigo (Hit Flash); 3) Partículas de impacto; e 4) Um efeito sonoro com leve variação aleatória de tom (Pitch entre 0.9 e 1.1) para não cansar o ouvido.",
          "Para criação de fases, utilize sistemas de TileMap com Auto-Tiling (Terrain Sets) para desenhar cenários inteiros em minutos."
        ],
        "checklist": [
          "Ferramentas gratuitas essenciais de Arte: Aseprite / LibreSprite (Pixel Art), Blender (Modelagem 3D), Kenney.nl (Pacotes de Assets gratuitos CC0).",
          "Ferramentas gratuitas de Áudio: Jsfxr / Bfxr (efeitos retrô e impactos instantâneos), Audacity e Bosca Ceoil / LMMS (trilha sonora).",
          "Adicione variação de Pitch (0.92 a 1.08) nos sons de passos e tiros para soar natural."
        ]
      },
      {
        "number": 4,
        "title": "Exportação, Polimento, Página da Loja e Publicação (Itch.io e Steam)",
        "paragraphs": [
          "Com o protótipo jogável do início ao fim (Menu Principal -> Gameplay -> Tela de Vitória/Game Over -> Sistema de Save em JSON), chega a hora de empacotar o executável para Windows, Linux e Web (HTML5/WebAssembly).",
          "Publicar uma versão gratuita ou demo no Itch.io no formato Web (jogável direto no navegador) multiplica por 10 o número de jogadores que testam seu jogo e deixam feedbacks valiosos.",
          "Para lançar comercialmente na Steam (via Steamworks Direct), o segredo de vendas está na criação antecipada da sua página para acumular Wishlists (Listas de Desejos), com um trailer de 45 segundos que mostre ação imediata nos primeiros 3 segundos."
        ],
        "checklist": [
          "Implemente salvamento de dados (Save/Load) serializando um dicionário em arquivo JSON criptografado ou binário.",
          "Teste seu jogo com amigos sem dar instruções verbais: observe onde eles têm dificuldade para ajustar o Level Design.",
          "Exporte o pacote final com os templates de exportação oficiais da engine e publique seu portfólio no Itch.io e GitHub."
        ]
      }
    ]
  },
  {
    "id": 104,
    "slug": "curso-ciberseguranca-blindagem-contas",
    "title": "Curso & Guia PDF: Cibersegurança Gamer, Blindagem de Contas 2FA & Criptografia Digital",
    "shortTitle": "Ciberseguranca Gamer, 2FA & Blindagem Digital",
    "category": "CURSO & GUIA PDF",
    "categoryFilter": "seguranca",
    "categoryLabel": "Cibersegurança & Contas",
    "price": 14.9,
    "old_price": 49.9,
    "workload": "10 Horas (Vídeo + Apostila PDF)",
    "pdfPages": 42,
    "level": "Essencial para Todos",
    "rating": 4.9,
    "studentsCount": 1650,
    "pdfUrl": "/pdfs/curso-ciberseguranca-blindagem-contas.pdf",
    "image": "https://images.unsplash.com/photo-1563986768609-322da13575f3?q=80&w=1200&auto=format&fit=crop",
    "genres": "Curso, Guia PDF, Videoaulas, Segurança, Hacker, Utilitários, Educativo",
    "summary": "Proteja definitivamente suas contas Steam, Epic Games, PSN, Xbox, Discord, e-mails e carteiras digitais contra invasões, roubo de sessão (Session Hijacking), API Scams e Phishing. Aprenda a usar Gerenciadores de Senhas criptografados, 2FA por hardware/TOTP e blindagem de rede.",
    "lessons": [
      {
        "number": 1,
        "title": "Gerenciadores de Senhas, 2FA e Criptografia: O Guia Definitivo de Segurança",
        "duration": "28:15",
        "youtubeId": "s7ldn31OEFc",
        "channel": "Fabio Akita",
        "summary": "Aula magistral sobre como senhas são vazadas, por que você nunca deve repetir senhas e como funcionam cofres criptografados e 2FA."
      },
      {
        "number": 2,
        "title": "Autenticação de Dois Fatores (2FA): A Camada que Impede 99% das Invasões",
        "duration": "12:30",
        "youtubeId": "vpCO4M5SfOo",
        "channel": "iTProtect",
        "summary": "Diferença entre 2FA por SMS (vulnerável a SIM Swap), e-mail, aplicativos autenticadores TOTP e chaves físicas FIDO2."
      },
      {
        "number": 3,
        "title": "Como Proteger Contas Críticas contra Hackers: 2FA e Anti-Phishing na Prática",
        "duration": "16:05",
        "youtubeId": "NRNpfIIHXak",
        "channel": "Diovane Lopes",
        "summary": "Configuração de códigos anti-phishing, isolamento de e-mail exclusivo para contas valiosas e revogação de sessões ativas."
      },
      {
        "number": 4,
        "title": "Segurança de E-mail Criptografado e Proteção Avançada de Credenciais",
        "duration": "11:40",
        "youtubeId": "BN7l1XAvpnc",
        "channel": "Coach De Osasco",
        "summary": "Por que seu e-mail principal é a chave-mestra de todas as suas contas de jogos e como blindá-lo contra recuperação indevida."
      },
      {
        "number": 5,
        "title": "Alerta Prático: Como Configurar e Fazer Backup dos Códigos de Recuperação 2FA",
        "duration": "06:20",
        "youtubeId": "kAh8K2Oo4dE",
        "channel": "Cyber Alerta",
        "summary": "Passo a passo rápido para ativar 2FA em todas as plataformas e guardar os Backup Codes offline com segurança."
      }
    ],
    "modules": [
      {
        "number": 1,
        "title": "Anatomia dos Golpes em Contas Gamer (API Scam, Phishing e Stealers)",
        "paragraphs": [
          "Mais de 90% dos roubos de contas Steam, Discord e Epic Games não acontecem por \"força bruta\" de senha, mas sim por três vetores modernos: 1) Sites falsos de torneios/sorteios de skins que imitam a janela de login da Steam (Fake OAuth Popup); 2) Roubo de chave de API Web da Steam (API Key Scam); e 3) Executáveis maliciosos (InfoStealers) disfarçados de mods, instaladores piratas ou programas de voz.",
          "Quando um usuário digita seu código Steam Guard em um site falso, o atacante captura o token de sessão e pode registrar uma Chave de API Web na conta da vítima para monitorar e redirecionar trocas de itens em tempo real.",
          "Compreender esses vetores permite identificar qualquer tentativa de engenharia social em segundos, antes mesmo de clicar em um link suspeito."
        ],
        "checklist": [
          "Verifique regularmente a página oficial https://steamcommunity.com/dev/apikey — se houver qualquer chave registrada que você não criou, clique em \"Revogar Minha Chave da Web API\" imediatamente!",
          "Nunca faça login com a Steam em sites recebidos por mensagens diretas no Discord ou chat de desconhecidos.",
          "No navegador oficial (Chrome/Edge/Firefox), faça login uma única vez em store.steampowered.com marcando \"Lembrar de mim\": qualquer site legítimo que use OpenID mostrará apenas um botão verde \"Iniciar Sessão\" sem pedir sua senha novamente!"
        ]
      },
      {
        "number": 2,
        "title": "Gerenciadores de Senhas Criptografados (Bitwarden / KeePassXC)",
        "paragraphs": [
          "O maior risco à sua vida digital é reutilizar a mesma senha em vários sites. Quando um fórum ou loja menor sofre vazamento de banco de dados, robôs automatizados testam essa mesma combinação de e-mail e senha na Steam, Epic, Riot, PayPal e Gmail em minutos (ataque conhecido como Credential Stuffing).",
          "A solução definitiva é utilizar um Gerenciador de Senhas de código aberto e criptografia ponta a ponta (Zero-Knowledge), como o Bitwarden ou o KeePassXC.",
          "Com ele, você precisa memorizar apenas UMA Senha-Mestra forte (uma frase-senha de 4 ou 5 palavras aleatórias), enquanto o cofre gera e preenche senhas únicas de 24 caracteres aleatórios para cada site. Além disso, o preenchimento automático só funciona se o domínio do site for 100% autêntico, bloqueando sites de phishing automaticamente!"
        ],
        "checklist": [
          "Crie uma conta gratuita no Bitwarden (ou instale o KeePassXC offline) e proteja-o com uma Senha-Mestra única que nunca foi usada em nenhum outro lugar.",
          "Substitua as senhas do seu E-mail Principal, Steam, Epic Games, Discord e Banco por senhas geradas aleatoriamente com 20+ caracteres.",
          "Verifique no site oficial https://haveibeenpwned.com se o seu endereço de e-mail já apareceu em vazamentos antigos."
        ]
      },
      {
        "number": 3,
        "title": "Domínio da Autenticação em Dois Fatores (2FA TOTP vs SMS)",
        "paragraphs": [
          "A autenticação de dois fatores via SMS é vulnerável ao golpe de \"SIM Swap\" (quando criminosos transferem seu número de telefone para outro chip). Por isso, para contas de alto valor, você deve sempre usar aplicativos autenticadores baseados no padrão TOTP (Time-based One-Time Password).",
          "Aplicativos recomendados como Ente Auth, Aegis Authenticator (Android), 2FAS ou Microsoft/Google Authenticator geram códigos temporários de 6 dígitos que mudam a cada 30 segundos diretamente no seu dispositivo, sem depender de sinal de operadora.",
          "Ao ativar o 2FA e o Steam Guard Mobile Authenticator, o sistema fornece um Código de Recuperação (na Steam, começa com a letra \"R\" seguida de 5 dígitos). Anote esse código em papel físico e guarde em local seguro!"
        ],
        "checklist": [
          "Ative o Steam Guard Mobile Authenticator no aplicativo oficial da Steam para celular e anote seu código de recuperação R-XXXXX em papel.",
          "Ative o 2FA via aplicativo autenticador (TOTP) na sua conta Google/Outlook, Discord, Epic Games e Xbox/Microsoft.",
          "Desative o recebimento de códigos de recuperação por SMS no seu e-mail principal, mantendo apenas o autenticador TOTP e códigos de backup impressos."
        ]
      },
      {
        "number": 4,
        "title": "Higiene Digital, DNS Seguro com Filtro de Malware e Blindagem do Windows",
        "paragraphs": [
          "Um computador seguro começa pela rede e pelo navegador. Ao configurar o DNS do seu roteador ou placa de rede para o Cloudflare Security (1.1.1.2 / 1.0.0.2) ou Quad9 (9.9.9.9), domínios conhecidos de phishing, malware e roubo de contas são bloqueados diretamente na camada de resolução de nomes.",
          "No navegador, o uso de bloqueadores de conteúdo de código aberto como o uBlock Origin impede não apenas propagandas intrusivas, mas também anúncios falsos patrocinados em buscadores que levam a sites clones (malvertising).",
          "No Windows, mantenha a exibição de extensões de arquivos ativada no Explorer para nunca cair no truque de arquivos \"foto.png.exe\" ou \"mod_traducao.scr\"."
        ],
        "checklist": [
          "No Windows Explorer > Exibir > Mostrar: marque obrigatoriamente a opção \"Extensões de nomes de arquivos\".",
          "Instale a extensão uBlock Origin no seu navegador para bloquear domínios de phishing e malvertising.",
          "Antes de abrir arquivos pequenos baixados da internet, faça a verificação gratuita em 70 antivírus simultâneos no site https://www.virustotal.com."
        ]
      }
    ]
  },
  {
    "id": 105,
    "slug": "curso-obs-studio-live-streaming",
    "title": "Curso & Guia PDF: Live Streaming Profissional, OBS Studio Masterclass & Criação de Conteúdo",
    "shortTitle": "OBS Studio Masterclass & Live Streaming Pro",
    "category": "CURSO & GUIA PDF",
    "categoryFilter": "esports",
    "categoryLabel": "Streaming & Criação de Conteúdo",
    "price": 22.9,
    "old_price": 79.9,
    "workload": "16 Horas (Vídeo + Apostila PDF)",
    "pdfPages": 52,
    "level": "Iniciante ao Avançado",
    "rating": 4.9,
    "studentsCount": 890,
    "pdfUrl": "/pdfs/curso-obs-studio-live-streaming.pdf",
    "image": "https://images.unsplash.com/photo-1598550476439-6847785fcea6?q=80&w=1200&auto=format&fit=crop",
    "genres": "Curso, Guia PDF, Videoaulas, Streaming, Produção de Vídeo, Produção de Áudio, Educativo",
    "summary": "Aprenda a configurar o OBS Studio como um estúdio de TV profissional! Domine codecs NVENC/AMF, taxas de bits (Bitrate) para Twitch, YouTube e TikTok sem perder FPS nos jogos, tratamento de voz de estúdio com filtros nativos (Supressão de Ruído, Compressor, Equalizador) e criação de cenas.",
    "lessons": [
      {
        "number": 1,
        "title": "OBS Studio - Configuração Completa Passo a Passo para Gravação e Live Stream",
        "duration": "29:40",
        "youtubeId": "OXNrUL738as",
        "channel": "Abrigo76",
        "summary": "Guia completo atualizado da interface do OBS Studio, configuração de vídeo, áudio, cenas, fontes e transmissão ao vivo."
      },
      {
        "number": 2,
        "title": "Como Configurar o OBS Studio para Lives e Gravações com Qualidade Profissional",
        "duration": "24:15",
        "youtubeId": "yqOp9IylR4E",
        "channel": "Ian Worcman | Dicas OBS",
        "summary": "Configuração de encoders de hardware, escala de resolução, gerenciamento de faixas de áudio separadas e qualidade cristalina."
      },
      {
        "number": 3,
        "title": "A Melhor Configuração de Codificação e Bitrate do OBS Studio",
        "duration": "15:30",
        "youtubeId": "kOwM7Vi-U1M",
        "channel": "Saimon Oliveira",
        "summary": "Ajustes finos de CBR vs CQP, B-Frames, Look-ahead, Psycho Visual Tuning e presets de qualidade máxima."
      },
      {
        "number": 4,
        "title": "Melhor Configuração do OBS Studio para PC Fraco (Fazer Live Sem Travar)",
        "duration": "13:10",
        "youtubeId": "XPxqdwxsNQo",
        "channel": "NooB Stream Tech",
        "summary": "Como transmitir em 720p60 ou 936p60 consumindo menos de 3% do processador para não perder desempenho no jogo."
      },
      {
        "number": 5,
        "title": "Como Fazer Live no TikTok, YouTube e Twitch com OBS Passo a Passo",
        "duration": "11:25",
        "youtubeId": "mQuJmH8o-p4",
        "channel": "vitinCtrL",
        "summary": "Configuração de chave de transmissão, layout vertical/horizontal simultâneo (Aitum Vertical) e alertas na tela."
      }
    ],
    "modules": [
      {
        "number": 1,
        "title": "Arquitetura de Cenas, Fontes e Captura de Jogo sem Queda de FPS",
        "paragraphs": [
          "O erro mais comum de quem começa a fazer lives ou gravar gameplays no OBS Studio é usar a \"Captura de Tela\" (Display Capture) na mesma cena em que está a \"Captura de Jogo\" (Game Capture). Isso força o Windows a duplicar o buffer de composição (DWM), derrubando o FPS e causando micro-travamentos.",
          "A estrutura profissional separa o projeto em 4 Cenas limpas: 1) \"Iniciando Live\" (Contagem regressiva + música); 2) \"Bate-Papo / Just Chatting\" (Webcam em tela cheia + Chat); 3) \"Gameplay Principal\" (Apenas Captura de Jogo + Webcam em moldura + Alertas); e 4) \"Encerramento\".",
          "Sempre execute o OBS Studio como Administrador: isso garante prioridade na fila da GPU para que o OBS nunca trave sua transmissão mesmo quando o jogo atingir 99% de uso da placa de vídeo."
        ],
        "checklist": [
          "Clique com o botão direito no ícone do OBS Studio > Propriedades > Compatibilidade > Marque \"Executar este programa como administrador\".",
          "Nunca coloque \"Captura de Tela\" e \"Captura de Jogo\" dentro da mesma Cena!",
          "Desative a pré-visualização (Preview) do OBS durante jogos muito pesados clicando com o botão direito no palco se precisar economizar 2% a 4% de GPU."
        ]
      },
      {
        "number": 2,
        "title": "Engenharia de Vídeo: Encoders NVENC, AMF, QuickSync e Tabelas de Bitrate",
        "paragraphs": [
          "Para transmitir ao vivo (Live Streaming), o controle de taxa de bits deve ser obrigatoriamente CBR (Constant Bitrate — Taxa de Bits Constante). Já para gravação local no seu SSD para editar depois no Premiere/CapCut/DaVinci, utilize CQP (Constant Quantization Parameter, nível 18 a 22), que adapta a taxa de bits dinamicamente sem desperdiçar espaço em cenas paradas.",
          "Se você possui placa NVIDIA GTX 1650 Super ou qualquer RTX (série 20, 30, 40 ou 50), selecione o encoder \"NVIDIA NVENC H.264\" (ou AV1/HEVC para YouTube). Ele utiliza um chip dedicado separado na placa de vídeo, gerando impacto praticamente ZERO no FPS do jogo.",
          "Na Twitch, o limite oficial de bitrate é 6000 Kbps (para 1080p60 ou 936p60 — 1664x936 é a resolução secreta dos grandes streamers de FPS por evitar pixelização em movimentos rápidos!). No YouTube, você pode enviar de 10.000 a 18.000 Kbps em 1080p60 ou 1440p60."
        ],
        "checklist": [
          "Twitch (Jogos de Movimento Rápido/FPS): Resolução de Saída 1664x936 ou 1920x1080 a 60 FPS | Controle CBR | 6000 Kbps | Keyframe Interval: 2 s.",
          "YouTube Live: Resolução 1920x1080 ou 2560x1440 a 60 FPS | Encoder NVENC HEVC/AV1 ou H.264 | Controle CBR | 12.000 Kbps.",
          "Gravação Local no PC: Formato MKV (ou MP4 Fragmentado) | Controle de Taxa CQP (Nível 20) | Áudio em faixas separadas (Faixa 1: Tudo, Faixa 2: Só Microfone, Faixa 3: Só Jogo)."
        ]
      },
      {
        "number": 3,
        "title": "Áudio de Estúdio: A Cadeia Perfeita de Filtros de Microfone no OBS",
        "paragraphs": [
          "O público perdoa uma webcam simples ou um jogo em 720p, mas fecha a live em 5 segundos se o áudio estiver chiando, estourando ou mais baixo que o som do tiro do jogo. Com os filtros nativos gratuitos do OBS Studio, qualquer microfone USB ou headset pode soar como um estúdio de rádio.",
          "A ordem exata dos filtros no microfone é fundamental, pois o áudio passa de cima para baixo na lista: 1º Supressão de Ruído; 2º Filtro de Ruído (Noise Gate); 3º Equalizador de 3 Bandas; 4º Compressor; e 5º Limitador.",
          "Além disso, usamos o recurso \"Sidechain / Redução de Áudio (Ducking)\" no Compressor do Áudio do Desktop: toda vez que você fala no microfone, o volume do jogo/música abaixa suavemente em 4dB e volta ao normal quando você termina a frase!"
        ],
        "checklist": [
          "1º Filtro - Supressão de Ruído: Método RNNoise (IA de boa qualidade que remove barulho de ventilador e ar-condicionado).",
          "2º Filtro - Filtro de Ruído (Noise Gate): Limite de Fechamento -32 dB / Limite de Abertura -26 dB (corta barulhos de teclado quando você está calado).",
          "3º Filtro - Compressor: Razão 4:1 | Limiar -18 dB | Ataque 6 ms | Liberação 60 ms (iguala sussurros e falas altas).",
          "4º Filtro - Limitador: Limiar -3.0 dB (impede 100% que o áudio estoure quando você gritar ou comemorar uma jogada!)."
        ]
      },
      {
        "number": 4,
        "title": "Crescimento Acelerado: Alertas, Multistream, Cortes Virais e Monetização",
        "paragraphs": [
          "Fazer apenas lives longas sem distribuir cortes curtos é o maior obstáculo para novos criadores. A estratégia moderna de crescimento baseia-se no \"Ecossistema de Conteúdo\": enquanto você transmite ao vivo, utilize o Buffer deRepetição (Replay Buffer) do OBS com uma tecla de atalho para salvar os últimos 60 segundos sempre que acontecer uma jogada épica ou momento engraçado.",
          "Com o plugin gratuito Aitum Vertical no OBS, o próprio programa já grava a versão vertical (9:16 com câmera no topo e gameplay centralizada) pronta para postar no TikTok, YouTube Shorts e Instagram Reels em 2 minutos após encerrar a live.",
          "Configure seus alertas gratuitos no StreamElements (que roda em nuvem e consome apenas 1 fonte de navegador no OBS) para agradecer novos seguidores, inscritos e doações via LivePix na tela."
        ],
        "checklist": [
          "Ative o \"Buffer de Reprodução\" (Replay Buffer) em Configurações > Saída com tempo máximo de 60s e defina a tecla F9 para salvar clipes instantâneos.",
          "Use o StreamElements para unificar todos os alertas (Follower, Sub,Pix) em uma única Browser Source 1920x1080.",
          "Publique de 1 a 2 cortes verticais por dia das melhores jogadas da sua live no Shorts, Reels e TikTok apontando para o seu canal."
        ]
      }
    ]
  },
  {
    "id": 106,
    "slug": "curso-manutencao-limpeza-termica-pc",
    "title": "Curso & Guia PDF: Manutenção Preventiva, Limpeza Técnica e Refrigeração Térmica de PCs",
    "shortTitle": "Manutencao, Limpeza & Refrigeracao de PC Gamer",
    "category": "CURSO & GUIA PDF",
    "categoryFilter": "hardware",
    "categoryLabel": "Manutenção & Refrigeração",
    "price": 17.9,
    "old_price": 59.9,
    "workload": "12 Horas (Vídeo + Apostila PDF)",
    "pdfPages": 44,
    "level": "Iniciante ao Avançado",
    "rating": 4.9,
    "studentsCount": 740,
    "pdfUrl": "/pdfs/curso-manutencao-limpeza-termica-pc.pdf",
    "image": "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?q=80&w=1200&auto=format&fit=crop",
    "genres": "Curso, Guia PDF, Videoaulas, Hardware, Manutenção, Limpeza, Educativo",
    "summary": "Acabe com o superaquecimento (Thermal Throttling), barulho excessivo de ventoinhas e perda de desempenho! Aprenda a limpar seu PC Gamer com segurança antiestática, escolher e aplicar pasta térmica de alta condutividade, configurar curvas de Fan e otimizar o fluxo de ar (Airflow).",
    "lessons": [
      {
        "number": 1,
        "title": "Como Limpar seu PC Gamer Passo a Passo: Limpeza Rápida, Segura e Eficaz",
        "duration": "19:50",
        "youtubeId": "6Z-iFYyzpsg",
        "channel": "TecnoArt",
        "summary": "Quais produtos usar (Álcool Isopropílico 99%, pincel antiestático, limpa-contatos) e o que JAMAIS passar nas placas eletrônicas."
      },
      {
        "number": 2,
        "title": "Não Erre Mais ao Aplicar Pasta Térmica! Guia Técnico Definitivo",
        "duration": "14:15",
        "youtubeId": "T4ffUHj36eg",
        "channel": "EduGouveia Hardware",
        "summary": "Entenda condutividade térmica (W/mK), viscosidade, efeito pump-out e a quantidade exata para CPUs e GPUs."
      },
      {
        "number": 3,
        "title": "O Jeito Certo de Retirar a Pasta Antiga e Aplicar Nova no Processador",
        "duration": "08:30",
        "youtubeId": "GyaQJS-bKmE",
        "channel": "KaBuM!",
        "summary": "Procedimento seguro para remover o cooler sem arrancar o processador junto (especialmente em soquetes AMD AM4) e higienizar o IHS."
      },
      {
        "number": 4,
        "title": "Passo a Passo Direto: Trocando a Pasta Térmica do PC na Prática",
        "duration": "10:20",
        "youtubeId": "wON6TuHNUhM",
        "channel": "techgus",
        "summary": "Demonstração prática do antes e depois nas temperaturas em estresse usando monitoramento em tempo real."
      },
      {
        "number": 5,
        "title": "Padrões de Aplicação de Pasta Térmica e Espalhamento sob Pressão",
        "duration": "03:15",
        "youtubeId": "ZnwxuH24Uew",
        "channel": "TJ Gaming",
        "summary": "Comparativo visual de espalhamento com espátula, ponto central e cruz sobre a superfície do processador."
      }
    ],
    "modules": [
      {
        "number": 1,
        "title": "Diagnóstico Térmico: Identificando Thermal Throttling no CPU e GPU",
        "paragraphs": [
          "Quando um processador ou placa de vídeo ultrapassa seu limite térmico seguro (geralmente 85°C a 95°C na CPU e 83°C a 88°C no Hotspot da GPU), entra em ação um mecanismo de autoproteção chamado \"Thermal Throttling\": o chip derruba drasticamente seus clocks e tensão para não queimar, causando quedas severas de FPS no meio da partida.",
          "Antes de desmontar o computador, utilize o HWiNFO64 ou o MSI Afterburner (RivaTuner) para registrar as temperaturas em repouso (Idle: ideal entre 35°C e 48°C) e em carga máxima de jogo (Load: ideal entre 60°C e 78°C).",
          "Se a temperatura subir instantaneamente para 90°C+ em 3 segundos após abrir um jogo, isso indica pasta térmica ressecada, cooler mal encaixado ou bomba de Watercooler travada."
        ],
        "checklist": [
          "Instale o HWiNFO64 (modo Sensors Only) e monitore \"CPU Package Temperature\", \"GPU Temperature\" e \"GPU Hot Spot\".",
          "Diferença (Delta) entre GPU Temperature e GPU Hot Spot deve ser de até 12°C-15°C. Se passar de 25°C, a pasta térmica da placa de vídeo precisa de troca.",
          "Realize a limpeza preventiva de filtros de poeira a cada 30 dias e a limpeza interna completa a cada 6 meses."
        ]
      },
      {
        "number": 2,
        "title": "Ferramentas Corretas e Regras de Ouro Antiestática (O Que Nunca Usar)",
        "paragraphs": [
          "A limpeza de componentes eletrônicos exige três materiais básicos: 1) Álcool Isopropílico 99,8% (Isopropanol — possui menos de 0,2% de água e evapora em segundos sem oxidar circuitos); 2) Pincel de cerdas macias antiestáticas (ou de pelo natural); e 3) Soprador de ar elétrico ou ar comprimido em lata.",
          "JAMAIS utilize álcool líquido doméstico de supermercado (70% ou 46%, pois contém 30% a 54% de água que causa oxidação e curto-circuito!), secador de cabelo comum (gera eletricidade estática intensa) ou aspirador de pó encostado na placa-mãe.",
          "Regra vital ao usar ar comprimido ou soprador nas ventoinhas (Fans): SEMPRE segure as hélices da ventoinha com o dedo para que elas não girem com o jato de ar! Uma ventoinha girando em altíssima rotação pelo vento funciona como um dínamo (gerador elétrico), injetando tensão reversa direto na placa-mãe e podendo queimar o controlador PWM."
        ],
        "checklist": [
          "Desligue a chave da fonte, desconecte o cabo de força da tomada e aperte o botão Power do gabinete por 5 segundos para descarregar os capacitores.",
          "Trave as hélices das ventoinhas do gabinete, cooler e placa de vídeo com o dedo antes de aplicar jato de ar.",
          "Para limpar os contatos dourados das memórias RAM e da placa de vídeo, use limpa-contatos spray ou passe levemente papel sulfite limpo com álcool isopropílico."
        ]
      },
      {
        "number": 3,
        "title": "Remoção Segura do Cooler e Aplicação Perfeita de Pasta Térmica",
        "paragraphs": [
          "Em processadores AMD soquete AM4 (Ryzen série 1000 a 5000), a pasta térmica antiga pode criar um efeito de ventosa que gruda o processador na base do cooler. Se você puxar o cooler reto para cima com o PC frio, corre o risco de arrancar o processador do soquete fechado e entortar os pinos!",
          "O procedimento profissional consiste em ligar o PC por 5 minutos antes da manutenção para amolecer a pasta térmica antiga. Após desligar e soltar os parafusos do cooler, dê uma leve girada lateral (horária/anti-horária) no cooler para quebrar o vácuo antes de levantá-lo.",
          "Limpe o topo metálico do processador (IHS) e a base do cooler com papel toalha que não solte fiapos (ou filtro de café de papel!) umedecido em Álcool Isopropílico 99% até ficar espelhado. Em seguida, aplique pastas térmicas de alta performance (não condutivas eletricamente, como Arctic MX-4/MX-6, Cooler Master MasterGel ou Snowdog) usando um fino \"X\" ou espalhando uma camada fina uniforme com a espátula."
        ],
        "checklist": [
          "Em AMD AM4: Aqueça o PC por 5 minutos antes de desligar e GITE levemente o cooler para os lados antes de puxar!",
          "Use filtro de café de papel + Álcool Isopropílico 99% para remover a pasta ressecada sem deixar fiapos.",
          "Escolha pastas térmicas com condutividade real acima de 8.5 W/mK e que sejam NÃO-condutivas elétricas (evite metal líquido se for iniciante)."
        ]
      },
      {
        "number": 4,
        "title": "Engenharia de Airflow (Pressão Positiva) e Curva de Ventoinhas na BIOS",
        "paragraphs": [
          "O ar quente sempre sobe por convecção natural. Portanto, o fluxo de ar (Airflow) perfeito dentro do gabinete deve seguir um túnel contínuo: as ventoinhas da Frente e de Baixo puxam ar frio de fora para dentro (Intake), enquanto as ventoinhas de Trás e do Topo jogam o ar quente de dentro para fora (Exhaust).",
          "Como saber para qual lado a ventoinha sopra? Olhe para a estrutura plástica da ventoinha: o ar entra pela frente \"aberta/bonita\" e sai pelo lado traseiro onde ficam as hastes plásticas (a grade em X que segura o motor central).",
          "Mantenha uma leve \"Pressão Positiva\" no gabinete (ex: 3 ventoinhas puxando ar para dentro passando por filtros de poeira e 2 ventoinhas jogando ar para fora). Isso impede que a poeira seja sugada pelas frestas não filtradas do gabinete!"
        ],
        "checklist": [
          "Regra visual das Fans: A face aberta puxa o ar; a face com a grade plástica do motor empurra o ar.",
          "Frente e Base do gabinete = Entrada de Ar Frio (Intake) | Traseira e Topo = Saída de Ar Quente (Exhaust).",
          "Se usar Watercooler (AIO), a bomba (bloco sobre a CPU) NUNCA deve ser o ponto mais alto do circuito: posicione o radiador no topo ou na frente com o topo do radiador acima da altura da bomba para que bolhas de ar não acumulem no rotor."
        ]
      }
    ]
  },
  {
    "id": 107,
    "slug": "curso-programacao-python-iniciantes",
    "title": "Curso & Guia PDF: Programação Python Completa do Zero (Lógica, Automação, Scripts e Bots)",
    "shortTitle": "Programacao Python do Zero, Automacao & Bots",
    "category": "CURSO & GUIA PDF",
    "categoryFilter": "dev",
    "categoryLabel": "Programação & Automação",
    "price": 27.9,
    "old_price": 99.9,
    "workload": "22 Horas (Vídeo + Apostila PDF)",
    "pdfPages": 60,
    "level": "Iniciante ao Avançado",
    "rating": 5,
    "studentsCount": 2150,
    "pdfUrl": "/pdfs/curso-programacao-python-iniciantes.pdf",
    "image": "https://images.unsplash.com/photo-1526379095098-d400fd0bf935?q=80&w=1200&auto=format&fit=crop",
    "genres": "Curso, Guia PDF, Videoaulas, Programação, Automação, Inteligência Artificial, Educativo",
    "summary": "Domine a linguagem de programação mais versátil e requisitada do mundo! Aprenda lógica de programação em Python desde o absoluto zero, estruturas de dados, orientação a objetos, consumo de APIs REST, automação de tarefas repetitivas no PC, Web Scraping e criação de Bots.",
    "lessons": [
      {
        "number": 1,
        "title": "Curso Python #01 - Seja um Programador: Introdução à Lógica e Carreira",
        "duration": "29:05",
        "youtubeId": "S9uPNppGsGo",
        "channel": "Curso em Vídeo",
        "summary": "Como pensar como um programador, funcionamento de algoritmos e por que o Python é a porta de entrada ideal para tecnologia e IA."
      },
      {
        "number": 2,
        "title": "Curso Python #02 - Para que Serve o Python e Onde Ele é Utilizado?",
        "duration": "21:50",
        "youtubeId": "Mp0vhMDI7fA",
        "channel": "Curso em Vídeo",
        "summary": "Aplicações práticas do Python em automação, inteligência artificial, ciência de dados, servidores web e scripts de jogos."
      },
      {
        "number": 3,
        "title": "Curso de Python na Prática: Primeiros Comandos e Sintaxe Limpa",
        "duration": "18:20",
        "youtubeId": "bHn91RxiTjY",
        "channel": "Didática Tech",
        "summary": "Mão na massa com os primeiros códigos, lógica sequencial, interpretação de variáveis e execução rápida."
      },
      {
        "number": 4,
        "title": "Por que Python + Instalação Completa e Configuração do Ambiente Profissional",
        "duration": "16:40",
        "youtubeId": "NRFZFXT1JvM",
        "channel": "Hashtag Programação",
        "summary": "Instalação do Python oficial, configuração do PATH no Windows e uso de editores modernos (VS Code / PyCharm)."
      },
      {
        "number": 5,
        "title": "Variáveis, Tipos de Dados, Entrada de Usuário e Operações Matemáticas",
        "duration": "22:10",
        "youtubeId": "BXzKS1heLNU",
        "channel": "Hashtag Programação",
        "summary": "Domínio de Strings, Inteiros, Floats, Booleanos, f-strings formatadas e criação dos primeiros programas interativos."
      }
    ],
    "modules": [
      {
        "number": 1,
        "title": "Configuração do Ambiente (Python 3 + VS Code) e Fundamentos da Sintaxe",
        "paragraphs": [
          "O Python foi projetado com foco em legibilidade humana: em vez de chaves \"{}\" ou ponto e vírgula \";\" no final de cada linha, o Python utiliza indentação (4 espaços) para definir blocos de código. Isso obriga o programador a escrever código limpo e organizado desde o primeiro dia.",
          "Ao instalar o Python em python.org, a regra número um no instalador do Windows é marcar a caixa \"Add Python.exe to PATH\" na primeira tela antes de clicar em Install Now. Em seguida, instale o Visual Studio Code (VS Code) e a extensão oficial \"Python\" da Microsoft.",
          "No Python, as variáveis têm tipagem dinâmica e forte: você armazena textos (str), números inteiros (int), números decimais (float) e valores lógicos (bool: True / False) de forma direta e combina variáveis dentro de textos usando f-strings: print(f\"Jogador {nome} atingiu {pontos} pontos!\")."
        ],
        "checklist": [
          "No instalador do Python para Windows, marque obrigatoriamente \"Add python.exe to PATH\".",
          "Verifique a instalação no terminal com: python --version e pip --version.",
          "Crie sempre ambientes virtuais isolados para seus projetos usando: python -m venv venv e ative com venv\\Scripts\\activate."
        ]
      },
      {
        "number": 2,
        "title": "Estruturas de Decisão (if/elif/else), Repetição (for/while) e Coleções",
        "paragraphs": [
          "Todo programa inteligente toma decisões e processa lotes de informações. Com as condicionais if, elif e else combinadas aos operadores lógicos (and, or, not), seu script avalia regras de negócios complexas em milissegundos.",
          "Para armazenar múltiplos dados, o Python oferece duas estruturas fundamentais que você usará em 99% dos projetos: as Listas (ex: jogos = [\"CS2\", \"Elden Ring\", \"GTA V\"]), que são coleções ordenadas e mutáveis acessadas por índice, e os Dicionários (ex: player = {\"nick\": \"Zher\", \"nivel\": 50, \"vip\": True}), que armazenam pares de Chave e Valor idênticos ao formato JSON usado em toda a internet.",
          "O laço \"for item in lista:\" percorre qualquer coleção com elegância, enquanto as List Comprehensions permitem filtrar e transformar milhares de registros em uma única linha de código."
        ],
        "checklist": [
          "Use Listas [] para sequências ordenadas de itens e Dicionários {} para objetos estruturados com chave: valor.",
          "Use enumerate(lista) dentro do for quando precisar tanto do índice quanto do valor: for idx, jogo in enumerate(jogos):.",
          "Evite loops infinitos acidentais no while garantindo que a condição de parada seja atualizada a cada iteração."
        ]
      },
      {
        "number": 3,
        "title": "Funções Modulares, Tratamento de Erros (try/except) e Arquivos JSON/CSV",
        "paragraphs": [
          "À medida que seu código cresce, repetir blocos de lógica torna a manutenção impossível. Aplicando o princípio DRY (Don't Repeat Yourself), encapsulamos tarefas específicas dentro de Funções usando a palavra-chave \"def calcular_desconto(preco, taxa):\".",
          "Programas do mundo real lidam com imprevistos: arquivos que não existem, internet que oscila ou usuário que digita letras onde deveria digitar números. O bloco \"try / except / finally\" captura qualquer exceção sem deixar o programa fechar abruptamente.",
          "Com os módulos nativos \"json\", \"csv\" e \"pathlib\", seu script Python pode ler planilhas de milhares de linhas, processar preços, gerar relatórios e salvar bancos de dados locais automaticamente."
        ],
        "checklist": [
          "Sempre abra arquivos usando o gerenciador de contexto \"with open('dados.json', 'r', encoding='utf-8') as f:\" — ele fecha o arquivo automaticamente.",
          "Use json.load(f) para ler arquivos JSON para dicionários Python e json.dump(dados, f, indent=2, ensure_ascii=False) para salvar.",
          "Capture exceções específicas (ex: except ValueError:, except FileNotFoundError:) para exibir mensagens claras ao usuário."
        ]
      },
      {
        "number": 4,
        "title": "Automação Prática, Consumo de APIs REST (requests) e Bots para Discord",
        "paragraphs": [
          "O verdadeiro superpoder do Python está no seu ecossistema de pacotes instalados via \"pip\". Com a biblioteca \"requests\", você conecta seu script a qualquer API da internet em 3 linhas de código (por exemplo, consultar cotações de moedas em tempo real, buscar preços na API da Steam ou enviar notificações via Webhook).",
          "Para automação de tarefas no computador, bibliotecas como \"pyautogui\" controlam mouse e teclado, enquanto \"playwright\" e \"selenium\" controlam navegadores inteiros para preencher formulários e extrair relatórios da web.",
          "Já com a biblioteca \"discord.py\", você cria um Bot completo para o seu servidor do Discord que responde a comandos de barra (/), modera canais, consulta APIs de jogos e envia alertas automáticos 24 horas por dia."
        ],
        "checklist": [
          "Instale a biblioteca de requisições HTTP com: pip install requests e faça chamadas seguras usando timeout: requests.get(url, timeout=10).",
          "Para enviar mensagens automáticas para um canal do Discord sem precisar de servidor complexo, crie um Webhook nas configurações do canal e faça um requests.post(webhook_url, json={\"content\": \"Alerta!\"}).",
          "Nunca deixe chaves de API ou tokens secretos escritos diretamente no código-fonte: utilize um arquivo .env com a biblioteca python-dotenv!"
        ]
      }
    ]
  },
  {
    "id": 108,
    "slug": "curso-treinamento-mira-fps-pro",
    "title": "Curso & Guia PDF: Treinamento Pro-Player FPS (Mira, Tracking, Movimentação e Táticas E-Sports)",
    "shortTitle": "Treinamento Pro-Player FPS: Mira, Tracking & Taticas",
    "category": "CURSO & GUIA PDF",
    "categoryFilter": "esports",
    "categoryLabel": "E-Sports & Competitivo",
    "price": 16.9,
    "old_price": 54.9,
    "workload": "12 Horas (Vídeo + Apostila PDF)",
    "pdfPages": 46,
    "level": "Iniciante ao Competitivo",
    "rating": 4.9,
    "studentsCount": 1530,
    "pdfUrl": "/pdfs/curso-treinamento-mira-fps-pro.pdf",
    "image": "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200&auto=format&fit=crop",
    "genres": "Curso, Guia PDF, Videoaulas, FPS, Competitivo, eSports, Tático, Educativo",
    "summary": "Desenvolva a memória muscular, o posicionamento de mira (Crosshair Placement) e a tomada de decisão dos jogadores profissionais de CS2, Valorant, Call of Duty, Rainbow Six e Apex Legends! Inclui planilha de rotina de treino diário em PDF, cálculo de eDPI perfeito e aulas práticas.",
    "lessons": [
      {
        "number": 1,
        "title": "Como Melhorar a Mira em Qualquer FPS! (CS2, Valorant, COD, BF e Apex)",
        "duration": "16:45",
        "youtubeId": "9YyCBlxw-m4",
        "channel": "fetansaD",
        "summary": "Os pilares mecânicos universais de todo jogo de tiro em primeira pessoa: sensibilidade real, pré-aim, micro-ajustes e consistência."
      },
      {
        "number": 2,
        "title": "Como Melhorar a Mira e Virar Pro em Qualquer FPS: Dominando o Tracking",
        "duration": "14:20",
        "youtubeId": "O59Lbk52lSs",
        "channel": "KILLERICIA",
        "summary": "Técnicas avançadas de acompanhamento de alvos em movimento (Tracking), leitura de mudança de direção (Strafing) e controle de tensão no braço."
      },
      {
        "number": 3,
        "title": "A Rotina Definitiva de Treino de Mira para Evolução Rápida",
        "duration": "11:15",
        "youtubeId": "-dPUZVR3nxc",
        "channel": "Entropico",
        "summary": "Como estruturar 20 minutos diários de aquecimento eficiente sem gerar fadiga no pulso antes das partidas ranqueadas."
      },
      {
        "number": 4,
        "title": "Ferramentas e Plataformas Gratuitas para Treinar Mira e Reflexo",
        "duration": "08:30",
        "youtubeId": "E7IZrkcKJJ0",
        "channel": "Fabioh Cortes",
        "summary": "Como usar simuladores de mira e conversores de sensibilidade entre diferentes jogos para manter a mesma memória muscular."
      },
      {
        "number": 5,
        "title": "Dicas Rápidas de Posicionamento de Mira (Crosshair Placement) e Flick",
        "duration": "04:10",
        "youtubeId": "TkjV0kYfS5A",
        "channel": "Jooge",
        "summary": "Como manter a mira sempre na altura da cabeça e reduzir o tempo de reação (Time to Damage) pela metade."
      }
    ],
    "modules": [
      {
        "number": 1,
        "title": "Ergonomia, Configuração de Mouse (DPI, Polling Rate) e Cálculo de eDPI",
        "paragraphs": [
          "O erro número 1 de jogadores que não conseguem ter consistência na mira é usar uma sensibilidade excessivamente alta combinada com a \"Aceleração do Ponteiro\" do Windows ativada. Com a aceleração ligada, mover o mouse a mesma distância física em velocidades diferentes desloca a mira para lugares diferentes, impedindo a criação de memória muscular.",
          "A grandeza real que define sua sensibilidade chama-se eDPI (Effective Dots Per Inch), calculada multiplicando o DPI do mouse pela Sensibilidade dentro do jogo (eDPI = DPI x Sensibilidade), ou medida em \"cm/360°\" (quantos centímetros você precisa mover o mouse no mousepad para seu personagem dar um giro completo de 360 graus).",
          "Em FPS táticos de precisão (CS2, Valorant, R6), 90% dos profissionais utilizam entre 35 cm/360° e 55 cm/360° (ex: 800 DPI com sensibilidade entre 0.28 e 0.42 no Valorant, ou 0.9 a 1.3 no CS2). Já em FPS rápidos de rastreamento (Apex, COD, Overwatch), a faixa ideal fica entre 25 cm/360° e 38 cm/360°."
        ],
        "checklist": [
          "No Windows: Painel de Controle > Mouse > Opções do Ponteiro: DESMARQUE \"Aprimorar a precisão do ponteiro\" (isso desativa a aceleração do Windows!) e deixe a velocidade no pino 6/11.",
          "Configure seu mouse gamer em 800 DPI ou 1600 DPI com Polling Rate em 1000Hz (ou 2000Hz/4000Hz se compatível).",
          "Use o braço/antebraço apoiado na mesa para giros amplos de câmera e o pulso/dedos apenas para micro-ajustes finos na cabeça do alvo."
        ]
      },
      {
        "number": 2,
        "title": "Os 3 Pilares da Mira: Crosshair Placement, Micro-Adjustment e Tracking",
        "paragraphs": [
          "A melhor mira do mundo é aquela que quase não precisa se mexer quando o inimigo aparece. Isso se chama \"Crosshair Placement\" (Posicionamento de Mira): manter sua retícula permanentemente na altura exata da cabeça dos adversários e colada na quina da parede de onde o inimigo pode surgir.",
          "Quando você abre um ângulo (Peek), diferencie o \"Pre-Aim\" (colocar a mira através da parede exatamente onde o inimigo costuma ficar antes mesmo de você dar o passo lateral) do \"Flick\" (puxada rápida de emergência). Jogadores de alto nível ganham 80% dos duelos no Pre-Aim e no Micro-Ajuste, usando Flicks apenas em situações inesperadas.",
          "Para o \"Tracking\" (acompanhar alvos que correm e pulam), o segredo é relaxar a mão: apertar o mouse com força gera atrito nos skates do mouse e faz sua mira tremer a cada mudança de direção do inimigo."
        ],
        "checklist": [
          "Proibido \"mirar no chão\" enquanto caminha pelo mapa: mantenha a mira 100% do tempo na linha da cabeça.",
          "Ao esperar um inimigo que vai correr para abrir um pixel (Wide Swing), desencoste sua mira 2 milímetros da parede para compensar o seu tempo de reação humano (~180ms).",
          "Relaxe a pressão dos dedos no mouse durante trocas de tiro longas para manter o Tracking suave."
        ]
      },
      {
        "number": 3,
        "title": "Movimentação Avançada: Counter-Strafing, Slicing the Pie e Vantagem de Ângulo",
        "paragraphs": [
          "Mira e movimentação no teclado (WASD) são inseparáveis. Em jogos táticos, atirar enquanto ainda está se movendo destrói a precisão do primeiro tiro. A técnica do \"Counter-Strafe\" consiste em soltar a tecla de movimento (ex: tecla A) e dar um toque rápido na tecla oposta (tecla D) para frear o boneco instantaneamente em zero milissegundos antes de clicar.",
          "Ao invadir um bomb ou sala com várias posições perigosas, utilize a técnica militar \"Slicing the Pie\" (Fatiar a Torta): limpe um único ângulo de cada vez usando apenas as teclas laterais A e D (nunca abra um pixel apertando W + A na diagonal!).",
          "Lembre-se também da Geometria de Perspectiva (Angle Advantage): quem está mais longe da quina da parede vê o ombro do adversário que está colado na parede antes de ser visto!"
        ],
        "checklist": [
          "Nunca abra pixels caminhando na diagonal (W + A ou W + D): abra sempre de forma 100% perpendicular (apenas A ou D) para ter velocidade lateral máxima.",
          "Quando estiver em desvantagem de distância da parede, nunca abra caminhando devagar (Shift): faça o peek rápido.",
          "Atire em rajadas curtas de 2 a 3 tiros (Burst) a longa distância combinando com passos laterais entre uma rajada e outra."
        ]
      },
      {
        "number": 4,
        "title": "Rotina Diária de 20 Minutos (Aim Lab / KovaaK's / Mapa de Treino) e Mindset",
        "paragraphs": [
          "Treinar mira por 2 horas seguidas causa tendinite e fadiga mental. A ciência do aprendizado motor comprova que 20 minutos diários focados e sem distrações antes de jogar geram evolução 5 vezes mais rápida.",
          "Divida seus 20 minutos em 4 blocos de 5 minutos: 1) Gridshot / Static Clicking (foco em precisão de 92%+ antes de velocidade); 2) Sixshot / Microshot (micro-ajustes em alvos pequenos na distância de headshot); 3) Smoothness / Strafe Tracking (acompanhar esfera em movimento contínuo); e 4) 5 minutos de Mata-Mata (Deathmatch) dentro do seu jogo principal focando apenas em Counter-Strafe e tiro na cabeça.",
          "Por fim, mantenha a disciplina competitiva: após uma derrota difícil, faça uma pausa de 5 minutos para beber água, nunca culpe fatores externos no microfone da equipe e comunique informações curtas e objetivas (Posição + Dano Causado)."
        ],
        "checklist": [
          "Bloco 1 (5 min): Alvos estáticos pequenos (Sixshot / 1w6ts) priorizando 95% de acerto sem afobar.",
          "Bloco 2 (5 min): Rastreamento contínuo (Tracking / Smoothbot) mantendo o pulso relaxado.",
          "Bloco 3 (10 min): Deathmatch no jogo principal treinando abertura de ângulos (Peeking) e posicionamento de mira na altura da cabeça."
        ]
      }
    ]
  }
];

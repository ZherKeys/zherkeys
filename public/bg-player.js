(function() {
    if (window.__bgMusicPlayerInitialized) return;
    window.__bgMusicPlayerInitialized = true;

    let playlist = [];
    let isEnabled = false;
    let isShuffle = true;
    let currentTrackIndex = 0;
    let playedHistory = [];
    let audio = null;
    let playerContainer = null;
    let isMinimized = false;

    let pausedByVideo = false;

    // Load persisted state from sessionStorage
    try {
        const savedIndex = sessionStorage.getItem('bg_music_track_index');
        if (savedIndex !== null) currentTrackIndex = parseInt(savedIndex, 10) || 0;
        const savedHistory = sessionStorage.getItem('bg_music_played_history');
        if (savedHistory) playedHistory = JSON.parse(savedHistory) || [];
        const savedMinimized = sessionStorage.getItem('bg_music_minimized');
        if (savedMinimized === 'true') isMinimized = true;
    } catch(e) {}

    window.pauseBgMusic = function() {
        if (audio && !audio.paused) {
            pausedByVideo = true;
            audio.pause();
        }
    };

    window.resumeBgMusic = function() {
        if (audio && (pausedByVideo || audio.paused)) {
            pausedByVideo = false;
            attemptPlay();
        }
    };

    async function init() {
        try {
            const res = await fetch('/api/site/music');
            if (!res.ok) return;
            const data = await res.json();
            
            isEnabled = data.enabled === true;
            isShuffle = data.shuffle !== false;
            playlist = Array.isArray(data.playlist) ? data.playlist : [];

            if (!isEnabled || playlist.length === 0) return;

            // Ensure currentTrackIndex is valid
            if (currentTrackIndex >= playlist.length) currentTrackIndex = 0;

            setupAudioElement();
            createPlayerUI();
            startPlayback();
        } catch(e) {
            console.error("Erro ao carregar player de música de fundo:", e);
        }
    }

    function setupAudioElement() {
        audio = new Audio();
        audio.preload = 'auto';

        audio.addEventListener('ended', () => {
            playNextTrack();
        });

        audio.addEventListener('timeupdate', () => {
            if (audio.currentTime > 0) {
                sessionStorage.setItem('bg_music_time', audio.currentTime.toString());
            }
        });

        audio.addEventListener('play', () => {
            sessionStorage.setItem('bg_music_playing', 'true');
            updateUIState(true);
        });

        audio.addEventListener('pause', () => {
            sessionStorage.setItem('bg_music_playing', 'false');
            updateUIState(false);
        });
    }

    function getNextTrackIndex() {
        if (playlist.length <= 1) return 0;

        if (isShuffle) {
            // Find unplayed track indices
            let unplayed = [];
            for (let i = 0; i < playlist.length; i++) {
                if (!playedHistory.includes(i) && i !== currentTrackIndex) {
                    unplayed.push(i);
                }
            }

            // If all tracks have been played, reset history cycle
            if (unplayed.length === 0) {
                playedHistory = [currentTrackIndex];
                unplayed = [];
                for (let i = 0; i < playlist.length; i++) {
                    if (i !== currentTrackIndex) unplayed.push(i);
                }
            }

            const randomIndex = Math.floor(Math.random() * unplayed.length);
            const nextIdx = unplayed[randomIndex];
            playedHistory.push(nextIdx);
            sessionStorage.setItem('bg_music_played_history', JSON.stringify(playedHistory));
            return nextIdx;
        } else {
            // Sequential playback
            return (currentTrackIndex + 1) % playlist.length;
        }
    }

    function loadTrack(index, startTime = 0) {
        if (!playlist[index]) return;
        currentTrackIndex = index;
        sessionStorage.setItem('bg_music_track_index', index.toString());

        const track = playlist[index];
        audio.src = track.url;
        if (startTime > 0) {
            audio.currentTime = startTime;
        }
        updateTrackInfoUI();
    }

    function startPlayback() {
        const savedTime = parseFloat(sessionStorage.getItem('bg_music_time') || '0');
        const wasPlaying = sessionStorage.getItem('bg_music_playing') !== 'false';

        loadTrack(currentTrackIndex, savedTime);

        if (wasPlaying) {
            attemptPlay();
        }

        // Global interaction fallback for browser autoplay restriction
        const enableOnInteraction = () => {
            if (audio && audio.paused) {
                attemptPlay();
            }
            document.removeEventListener('click', enableOnInteraction);
            document.removeEventListener('keydown', enableOnInteraction);
            document.removeEventListener('touchstart', enableOnInteraction);
        };

        document.addEventListener('click', enableOnInteraction);
        document.addEventListener('keydown', enableOnInteraction);
        document.addEventListener('touchstart', enableOnInteraction);
    }

    function attemptPlay() {
        if (!audio || !audio.src) return;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                updateUIState(true);
            }).catch(() => {
                // Autoplay blocked by browser policy - update UI state to prompt user
                updateUIState(false, true);
            });
        }
    }

    function playNextTrack() {
        sessionStorage.setItem('bg_music_time', '0');
        const nextIndex = getNextTrackIndex();
        loadTrack(nextIndex, 0);
        attemptPlay();
    }

    function togglePlayPause() {
        if (!audio) return;
        if (audio.paused) {
            attemptPlay();
        } else {
            audio.pause();
        }
    }

    function toggleMute() {
        if (!audio) return;
        audio.muted = !audio.muted;
        const muteBtn = document.getElementById('bg-music-mute-btn');
        if (muteBtn) {
            muteBtn.innerHTML = audio.muted ? '🔇' : '🔊';
        }
    }

    function toggleMinimize() {
        isMinimized = !isMinimized;
        sessionStorage.setItem('bg_music_minimized', isMinimized ? 'true' : 'false');
        const bodyContent = document.getElementById('bg-music-body');
        const toggleBtn = document.getElementById('bg-music-toggle-min');
        if (bodyContent) bodyContent.style.display = isMinimized ? 'none' : 'flex';
        if (toggleBtn) toggleBtn.innerText = isMinimized ? '🎵' : '✖';
    }

    function createPlayerUI() {
        if (document.getElementById('bg-music-widget')) return;

        playerContainer = document.createElement('div');
        playerContainer.id = 'bg-music-widget';
        playerContainer.style.cssText = `
            position: fixed;
            bottom: 16px;
            right: 16px;
            z-index: 999999;
            font-family: 'Orbitron', system-ui, -apple-system, sans-serif;
            background: rgba(2, 6, 23, 0.94);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(59, 130, 246, 0.4);
            border-radius: 9999px;
            padding: 6px 14px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.8), 0 0 15px rgba(59, 130, 246, 0.25);
            color: #ffffff;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            user-select: none;
        `;

        playerContainer.innerHTML = `
            <div id="bg-music-body" style="display: ${isMinimized ? 'none' : 'flex'}; align-items: center; gap: 10px;">
                <div style="display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; background: rgba(59,130,246,0.15); border-radius: 50%; color: #38bdf8; font-size: 13px;">
                    🎵
                </div>
                <div style="max-width: 140px; overflow: hidden; white-space: nowrap;">
                    <div id="bg-music-title" style="font-size: 11px; font-weight: 600; color: #f8fafc; text-overflow: ellipsis; overflow: hidden;">
                        Carregando...
                    </div>
                    <div id="bg-music-subtitle" style="font-size: 9px; color: #94a3b8;">
                        ${isShuffle ? '🔀 Aleatório' : '🔁 Sequencial'}
                    </div>
                </div>
                <button id="bg-music-play-btn" style="background: #3b82f6; border: none; color: white; width: 26px; height: 26px; border-radius: 50%; cursor: pointer; font-size: 11px; display: flex; align-items: center; justify-content: center; transition: transform 0.15s;" title="Play / Pause">
                    ▶
                </button>
                <button id="bg-music-next-btn" style="background: rgba(30,41,59,0.8); border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; font-size: 10px; display: flex; align-items: center; justify-content: center;" title="Próxima Música">
                    ⏭
                </button>
                <button id="bg-music-mute-btn" style="background: transparent; border: none; color: #94a3b8; cursor: pointer; font-size: 12px; padding: 2px;" title="Mudar Volume">
                    🔊
                </button>
            </div>
            <button id="bg-music-toggle-min" style="background: rgba(30,41,59,0.8); border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; font-size: 10px; display: flex; align-items: center; justify-content: center; margin-left: 2px;" title="Minimizar / Expandir">
                ${isMinimized ? '🎵' : '✖'}
            </button>
        `;

        document.body.appendChild(playerContainer);

        // Bind events
        document.getElementById('bg-music-play-btn').onclick = togglePlayPause;
        document.getElementById('bg-music-next-btn').onclick = playNextTrack;
        document.getElementById('bg-music-mute-btn').onclick = toggleMute;
        document.getElementById('bg-music-toggle-min').onclick = toggleMinimize;
    }

    function updateTrackInfoUI() {
        const titleEl = document.getElementById('bg-music-title');
        const subtitleEl = document.getElementById('bg-music-subtitle');
        if (!titleEl) return;
        const track = playlist[currentTrackIndex];
        if (track) {
            titleEl.innerText = track.title || `Faixa ${currentTrackIndex + 1}`;
            subtitleEl.innerText = `${isShuffle ? '🔀 Aleatório' : '🔁 Sequencial'} (${currentTrackIndex + 1}/${playlist.length})`;
        }
    }

    function updateUIState(isPlaying, isBlocked = false) {
        const playBtn = document.getElementById('bg-music-play-btn');
        if (!playBtn) return;
        if (isBlocked) {
            playBtn.innerText = '▶';
            playBtn.style.background = '#e11d48'; // Alert color prompting user click
            playBtn.title = 'Clique para ativar a música de fundo';
        } else if (isPlaying) {
            playBtn.innerText = '❚❚';
            playBtn.style.background = '#10b981'; // Green active playing state
            playBtn.title = 'Pausar Músicas';
        } else {
            playBtn.innerText = '▶';
            playBtn.style.background = '#3b82f6'; // Blue paused state
            playBtn.title = 'Tocar Músicas';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

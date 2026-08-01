(function() {
    if (window.__bgMusicPlayerInitialized) return;
    window.__bgMusicPlayerInitialized = true;

    let playlist = [];
    let isEnabled = false;
    let isShuffle = true;
    let currentTrackIndex = 0;
    let playedHistory = [];
    let audio = null;
    let ytPlayer = null;
    let isYtReady = false;
    let playerContainer = null;
    let isMinimized = false;
    let pausedByVideo = false;

    // Track user mouse/pointer/keyboard activity immediately from script load time
    let hasUserInteracted = false;

    function recordUserActivity() {
        hasUserInteracted = true;
        if (window.__unmuteBgMusic) {
            window.__unmuteBgMusic();
        }
    }

    // Attach listeners IMMEDIATELY as script executes (capturing mouse movement before/during page load)
    window.addEventListener('mousemove', recordUserActivity, { capture: true, passive: true });
    window.addEventListener('pointermove', recordUserActivity, { capture: true, passive: true });
    window.addEventListener('mouseover', recordUserActivity, { capture: true, passive: true });
    window.addEventListener('mouseenter', recordUserActivity, { capture: true, passive: true });
    window.addEventListener('scroll', recordUserActivity, { capture: true, passive: true });
    window.addEventListener('wheel', recordUserActivity, { capture: true, passive: true });
    window.addEventListener('click', recordUserActivity, { capture: true, passive: true });
    window.addEventListener('touchstart', recordUserActivity, { capture: true, passive: true });
    window.addEventListener('keydown', recordUserActivity, { capture: true, passive: true });
    window.addEventListener('focus', recordUserActivity, { capture: true, passive: true });

    // Master volume (persisted in localStorage)
    let masterVolume = 0.8;
    try {
        const savedMasterVol = localStorage.getItem('bg_music_master_vol');
        if (savedMasterVol !== null) masterVolume = parseFloat(savedMasterVol);
    } catch(e) {}

    function isYoutubeUrl(url) {
        if (!url) return false;
        return url.includes('youtube.com') || url.includes('youtu.be');
    }

    function getYoutubeId(url) {
        if (!url) return '';
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : '';
    }

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
        pausedByVideo = true;
        if (audio && !audio.paused) {
            audio.pause();
        }
        if (ytPlayer && isYtReady && typeof ytPlayer.pauseVideo === 'function') {
            try { ytPlayer.pauseVideo(); } catch(e){}
        }
    };

    window.resumeBgMusic = function() {
        if (pausedByVideo) {
            pausedByVideo = false;
            attemptPlay();
        }
    };

    window.__unmuteBgMusic = function() {
        if (pausedByVideo) return;

        if (audio) {
            if (audio.muted) audio.muted = false;
            applyEffectiveVolume();
            if (audio.paused) {
                audio.play().then(() => updateUIState(true)).catch(() => {});
            } else {
                updateUIState(true);
            }
        }
        if (ytPlayer && isYtReady) {
            try {
                if (typeof ytPlayer.unMute === 'function') ytPlayer.unMute();
                applyEffectiveVolume();
                ytPlayer.playVideo();
                updateUIState(true);
            } catch(e){}
        }
    };

    function getEffectiveVolume() {
        const track = playlist[currentTrackIndex];
        const trackBaseVol = (track && track.volume !== undefined && track.volume !== null) ? parseFloat(track.volume) : 1.0;
        return Math.max(0, Math.min(1, trackBaseVol * masterVolume));
    }

    function applyEffectiveVolume() {
        const effVol = getEffectiveVolume();
        if (audio) {
            audio.volume = effVol;
        }
        if (ytPlayer && isYtReady && typeof ytPlayer.setVolume === 'function') {
            try { ytPlayer.setVolume(Math.round(effVol * 100)); } catch(e){}
        }
    }

    async function init() {
        try {
            const res = await fetch('/api/site/music');
            if (!res.ok) return;
            const data = await res.json();
            
            isEnabled = data.enabled === true;
            isShuffle = data.shuffle !== false;
            playlist = Array.isArray(data.playlist) ? data.playlist : [];

            if (!isEnabled || playlist.length === 0) return;

            if (currentTrackIndex >= playlist.length) currentTrackIndex = 0;

            setupAudioElement();
            initYoutubeAPI();
            createPlayerUI();
            startPlayback();
        } catch(e) {
            console.error("Erro ao carregar player de música de fundo:", e);
        }
    }

    function setupAudioElement() {
        audio = new Audio();
        audio.preload = 'auto';
        audio.volume = getEffectiveVolume();

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

    function initYoutubeAPI() {
        let ytContainer = document.getElementById('bg-yt-container');
        if (!ytContainer) {
            ytContainer = document.createElement('div');
            ytContainer.id = 'bg-yt-container';
            ytContainer.style.cssText = 'position: fixed; width: 1px; height: 1px; left: -9999px; top: -9999px; pointer-events: none; opacity: 0; z-index: -1;';
            ytContainer.innerHTML = '<div id="bg-yt-player"></div>';
            document.body.appendChild(ytContainer);
        }

        const existingReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = function() {
            if (typeof existingReady === 'function') existingReady();
            createYtPlayerInstance();
        };

        if (window.YT && window.YT.Player) {
            createYtPlayerInstance();
        } else {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            if (firstScriptTag && firstScriptTag.parentNode) {
                firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            } else if (document.head) {
                document.head.appendChild(tag);
            }
        }
    }

    function createYtPlayerInstance() {
        if (ytPlayer || !window.YT) return;
        try {
            ytPlayer = new window.YT.Player('bg-yt-player', {
                height: '1',
                width: '1',
                playerVars: {
                    autoplay: 0,
                    controls: 0,
                    disablekb: 1,
                    fs: 0,
                    modestbranding: 1,
                    playsinline: 1
                },
                events: {
                    onReady: () => {
                        isYtReady = true;
                        applyEffectiveVolume();
                        const track = playlist[currentTrackIndex];
                        if (track && isYoutubeUrl(track.url)) {
                            const ytId = getYoutubeId(track.url);
                            if (ytId && ytPlayer && typeof ytPlayer.cueVideoById === 'function') {
                                ytPlayer.cueVideoById(ytId);
                            }
                        }
                        if (hasUserInteracted) {
                            window.__unmuteBgMusic();
                        }
                    },
                    onStateChange: (event) => {
                        // YT.PlayerState.ENDED = 0
                        if (event.data === 0) {
                            playNextTrack();
                        }
                        // YT.PlayerState.PLAYING = 1
                        else if (event.data === 1) {
                            sessionStorage.setItem('bg_music_playing', 'true');
                            updateUIState(true);
                        }
                        // YT.PlayerState.PAUSED = 2
                        else if (event.data === 2) {
                            sessionStorage.setItem('bg_music_playing', 'false');
                            updateUIState(false);
                        }
                    }
                }
            });
        } catch(e) {
            console.error("Erro ao instanciar YouTube Player:", e);
        }
    }

    function getNextTrackIndex() {
        if (playlist.length <= 1) return 0;

        if (isShuffle) {
            let unplayed = [];
            for (let i = 0; i < playlist.length; i++) {
                if (!playedHistory.includes(i) && i !== currentTrackIndex) {
                    unplayed.push(i);
                }
            }

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
            return (currentTrackIndex + 1) % playlist.length;
        }
    }

    function loadTrack(index, startTime = 0) {
        if (!playlist[index]) return;
        currentTrackIndex = index;
        sessionStorage.setItem('bg_music_track_index', index.toString());

        const track = playlist[index];
        const isYt = isYoutubeUrl(track.url);

        if (isYt) {
            if (audio && !audio.paused) audio.pause();
            const ytId = getYoutubeId(track.url);
            if (ytPlayer && isYtReady && ytId) {
                try {
                    ytPlayer.loadVideoById({ videoId: ytId, startSeconds: startTime });
                    applyEffectiveVolume();
                } catch(e){}
            }
        } else {
            if (ytPlayer && isYtReady && typeof ytPlayer.pauseVideo === 'function') {
                try { ytPlayer.pauseVideo(); } catch(e){}
            }
            audio.src = track.url;
            applyEffectiveVolume();
            if (startTime > 0) {
                audio.currentTime = startTime;
            }
        }
        updateTrackInfoUI();
    }

    function startPlayback() {
        const savedTime = parseFloat(sessionStorage.getItem('bg_music_time') || '0');
        loadTrack(currentTrackIndex, savedTime);

        attemptPlay();

        if (hasUserInteracted) {
            window.__unmuteBgMusic();
        }
    }

    function attemptPlay() {
        const track = playlist[currentTrackIndex];
        if (!track) return;

        applyEffectiveVolume();

        if (isYoutubeUrl(track.url)) {
            const ytId = getYoutubeId(track.url);
            if (ytPlayer && isYtReady) {
                try {
                    ytPlayer.playVideo();
                    updateUIState(true);
                } catch(e) {
                    updateUIState(false, true);
                }
            } else {
                setTimeout(attemptPlay, 300);
            }
        } else {
            if (!audio || !audio.src) return;
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    updateUIState(true);
                }).catch(() => {
                    audio.muted = true;
                    audio.play().then(() => {
                        updateUIState(true);
                    }).catch(() => {
                        updateUIState(false, true);
                    });
                });
            }
        }
    }

    function playNextTrack() {
        sessionStorage.setItem('bg_music_time', '0');
        const nextIndex = getNextTrackIndex();
        loadTrack(nextIndex, 0);
        attemptPlay();
    }

    function togglePlayPause() {
        const track = playlist[currentTrackIndex];
        if (!track) return;

        if (isYoutubeUrl(track.url)) {
            if (ytPlayer && isYtReady && typeof ytPlayer.getPlayerState === 'function') {
                const state = ytPlayer.getPlayerState();
                if (state === 1) {
                    ytPlayer.pauseVideo();
                } else {
                    ytPlayer.playVideo();
                }
            } else {
                attemptPlay();
            }
        } else {
            if (!audio) return;
            if (audio.paused) {
                if (audio.muted) audio.muted = false;
                attemptPlay();
            } else {
                audio.pause();
            }
        }
    }

    function toggleMute() {
        const track = playlist[currentTrackIndex];
        let isMuted = false;
        if (track && isYoutubeUrl(track.url) && ytPlayer && isYtReady) {
            if (ytPlayer.isMuted()) {
                ytPlayer.unMute();
                isMuted = false;
            } else {
                ytPlayer.mute();
                isMuted = true;
            }
        } else if (audio) {
            audio.muted = !audio.muted;
            isMuted = audio.muted;
        }

        const muteBtn = document.getElementById('bg-music-mute-btn');
        if (muteBtn) {
            muteBtn.innerHTML = isMuted ? '🔇' : '🔊';
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
                
                <!-- Wrapper do botão Mute com Popup de Volume Slide -->
                <div id="bg-music-mute-wrapper" style="position: relative; display: flex; align-items: center;">
                    <button id="bg-music-mute-btn" style="background: transparent; border: none; color: #94a3b8; cursor: pointer; font-size: 12px; padding: 2px;" title="Mudar Volume / Mute">
                        🔊
                    </button>
                    
                    <!-- Popover do Slide Sound (Barra de Volume para cima) -->
                    <div id="bg-music-volume-popover" style="position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%); background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(59, 130, 246, 0.5); backdrop-filter: blur(10px); padding: 10px 8px; border-radius: 12px; display: none; flex-direction: column; align-items: center; gap: 6px; box-shadow: 0 10px 25px rgba(0,0,0,0.8); z-index: 1000000; width: 34px;">
                        <span id="bg-music-vol-val-text" style="font-size: 9px; font-weight: bold; color: #38bdf8;">${Math.round(masterVolume * 100)}%</span>
                        <input type="range" id="bg-music-master-vol-slider" min="0" max="1" step="0.01" value="${masterVolume}" style="writing-mode: bt-lr; -webkit-appearance: slider-vertical; width: 8px; height: 80px; accent-color: #3b82f6; cursor: pointer;">
                    </div>
                </div>
            </div>
            <button id="bg-music-toggle-min" style="background: rgba(30,41,59,0.8); border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; font-size: 10px; display: flex; align-items: center; justify-content: center; margin-left: 2px;" title="Minimizar / Expandir">
                ${isMinimized ? '🎵' : '✖'}
            </button>
        `;

        document.body.appendChild(playerContainer);

        document.getElementById('bg-music-play-btn').onclick = togglePlayPause;
        document.getElementById('bg-music-next-btn').onclick = playNextTrack;
        document.getElementById('bg-music-mute-btn').onclick = toggleMute;
        document.getElementById('bg-music-toggle-min').onclick = toggleMinimize;

        const muteWrapper = document.getElementById('bg-music-mute-wrapper');
        const popover = document.getElementById('bg-music-volume-popover');
        const volSlider = document.getElementById('bg-music-master-vol-slider');
        const volText = document.getElementById('bg-music-vol-val-text');

        let popoverHideTimeout = null;

        if (muteWrapper && popover) {
            muteWrapper.onmouseenter = () => {
                if (popoverHideTimeout) clearTimeout(popoverHideTimeout);
                popover.style.display = 'flex';
            };
            muteWrapper.onmouseleave = () => {
                popoverHideTimeout = setTimeout(() => {
                    popover.style.display = 'none';
                }, 300);
            };
            popover.onmouseenter = () => {
                if (popoverHideTimeout) clearTimeout(popoverHideTimeout);
                popover.style.display = 'flex';
            };
            popover.onmouseleave = () => {
                popoverHideTimeout = setTimeout(() => {
                    popover.style.display = 'none';
                }, 300);
            };
        }

        if (volSlider) {
            volSlider.oninput = (e) => {
                masterVolume = parseFloat(e.target.value);
                localStorage.setItem('bg_music_master_vol', masterVolume.toString());
                if (volText) volText.innerText = Math.round(masterVolume * 100) + '%';
                applyEffectiveVolume();
                const muteBtn = document.getElementById('bg-music-mute-btn');
                if (muteBtn) muteBtn.innerHTML = masterVolume === 0 ? '🔇' : '🔊';
            };
        }
    }

    function updateTrackInfoUI() {
        const titleEl = document.getElementById('bg-music-title');
        const subtitleEl = document.getElementById('bg-music-subtitle');
        if (!titleEl) return;
        const track = playlist[currentTrackIndex];
        if (track) {
            const isYt = isYoutubeUrl(track.url);
            titleEl.innerText = (isYt ? '▶ YT: ' : '') + (track.title || `Faixa ${currentTrackIndex + 1}`);
            subtitleEl.innerText = `${isShuffle ? '🔀 Aleatório' : '🔁 Sequencial'} (${currentTrackIndex + 1}/${playlist.length})`;
        }
    }

    function updateUIState(isPlaying, isBlocked = false) {
        const playBtn = document.getElementById('bg-music-play-btn');
        if (!playBtn) return;
        if (isBlocked) {
            playBtn.innerText = '▶';
            playBtn.style.background = '#e11d48';
            playBtn.title = 'Clique para ativar a música de fundo';
        } else if (isPlaying) {
            playBtn.innerText = '❚❚';
            playBtn.style.background = '#10b981';
            playBtn.title = 'Pausar Músicas';
        } else {
            playBtn.innerText = '▶';
            playBtn.style.background = '#3b82f6';
            playBtn.title = 'Tocar Músicas';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

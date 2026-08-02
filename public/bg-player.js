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
    let userPaused = false;
    let userMuted = false;

    // Track user mouse/pointer/keyboard activity immediately from script load time
    let hasUserInteracted = false;
    let isUnmutedAndPlaying = false;

    const activityEvents = ['click', 'touchstart', 'touchend', 'pointerdown', 'mousedown', 'keydown', 'scroll', 'wheel', 'mousemove', 'focus'];

    function recordUserActivity(e) {
        hasUserInteracted = true;
        if (isUnmutedAndPlaying) {
            removeActivityListeners();
        }
    }

    function addActivityListeners() {
        activityEvents.forEach(evt => {
            window.addEventListener(evt, recordUserActivity, { capture: true, passive: true });
        });
    }

    function removeActivityListeners() {
        activityEvents.forEach(evt => {
            window.removeEventListener(evt, recordUserActivity, { capture: true, passive: true });
        });
    }

    // Attach listeners IMMEDIATELY as script executes (capturing mouse movement before/during page load)
    addActivityListeners();

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

    function getYoutubePlaylistId(url) {
        if (!url) return '';
        const match = url.match(/[?&]list=([^#\&\?]+)/);
        return match ? match[1] : '';
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

    let resumeTimeout = null;

    window.resumeBgMusic = function() {
        if (pausedByVideo) {
            if (resumeTimeout) clearTimeout(resumeTimeout);
            resumeTimeout = setTimeout(() => {
                if (!isAnyPageVideoPlaying()) {
                    userPaused = false;
                    pausedByVideo = false;
                    attemptPlay();
                    window.__unmuteBgMusic();
                }
            }, 5000);
        }
    };

    window.__unmuteBgMusic = function() {
        if (isAnyPageVideoPlaying()) return;

        const currentTrack = playlist[currentTrackIndex];
        const isYt = currentTrack ? isYoutubeUrl(currentTrack.url) : false;

        if (isYt) {
            if (ytPlayer && isYtReady) {
                try {
                    if (!userMuted && typeof ytPlayer.unMute === 'function') ytPlayer.unMute();
                    applyEffectiveVolume();
                    if (typeof ytPlayer.playVideo === 'function') {
                        ytPlayer.playVideo();
                    }
                    isUnmutedAndPlaying = true;
                    removeActivityListeners();
                    updateUIState(true);
                } catch(e){}
            }
        } else if (audio) {
            if (!audio.src && currentTrack) {
                audio.src = currentTrack.url;
            }
            if (!userMuted) audio.muted = false;
            applyEffectiveVolume();
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    if (!audio.muted && !audio.paused) {
                        isUnmutedAndPlaying = true;
                        removeActivityListeners();
                    }
                    updateUIState(!audio.paused && !audio.muted);
                }).catch(() => {
                    audio.muted = true;
                    audio.play().then(() => {
                        updateUIState(false, true);
                    }).catch(() => {
                        updateUIState(false, true);
                    });
                });
            }
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
                        try {
                            const bgYtContainer = document.getElementById('bg-yt-container');
                            const iframe = bgYtContainer ? bgYtContainer.querySelector('iframe') : document.getElementById('bg-yt-player');
                            if (iframe) window.__bgYtWindow = iframe.contentWindow;
                        } catch(e){}
                        applyEffectiveVolume();
                        const savedTime = parseFloat(sessionStorage.getItem('bg_music_time') || '0');
                        const track = playlist[currentTrackIndex];
                        if (track && isYoutubeUrl(track.url)) {
                            const ytId = getYoutubeId(track.url);
                            const ytListId = getYoutubePlaylistId(track.url);
                            if (ytListId && ytPlayer && typeof ytPlayer.cuePlaylist === 'function') {
                                ytPlayer.cuePlaylist({ list: ytListId, listType: 'playlist', index: 0, startSeconds: savedTime });
                            } else if (ytId && ytPlayer && typeof ytPlayer.cueVideoById === 'function') {
                                ytPlayer.cueVideoById({ videoId: ytId, startSeconds: savedTime });
                            }
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

            setInterval(() => {
                if (ytPlayer && isYtReady && typeof ytPlayer.getCurrentTime === 'function') {
                    try {
                        const curTime = ytPlayer.getCurrentTime();
                        if (curTime > 0) {
                            sessionStorage.setItem('bg_music_time', curTime.toString());
                        }
                    } catch(e){}
                }
            }, 1000);
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

        // Isolamento total de mídia: pausa e remove o áudio anterior para evitar tocar sozinho
        if (audio) {
            audio.pause();
            if (isYt) {
                audio.removeAttribute('src');
                audio.load();
            }
        }
        if (ytPlayer && isYtReady && typeof ytPlayer.pauseVideo === 'function') {
            try {
                ytPlayer.pauseVideo();
            } catch(e){}
        }

        if (isYt) {
            const ytListId = getYoutubePlaylistId(track.url);
            const ytId = getYoutubeId(track.url);
            if (ytPlayer && isYtReady) {
                try {
                    if (ytListId && typeof ytPlayer.cuePlaylist === 'function') {
                        ytPlayer.cuePlaylist({ list: ytListId, listType: 'playlist', index: 0, startSeconds: startTime });
                    } else if (ytId && typeof ytPlayer.cueVideoById === 'function') {
                        ytPlayer.cueVideoById({ videoId: ytId, startSeconds: startTime });
                    }
                    applyEffectiveVolume();
                } catch(e){}
            }
        } else {
            audio.src = track.url;
            applyEffectiveVolume();
            if (startTime > 0) {
                const setStartTime = () => {
                    try {
                        audio.currentTime = startTime;
                    } catch(e){}
                };
                if (audio.readyState >= 1) {
                    setStartTime();
                } else {
                    audio.addEventListener('loadedmetadata', setStartTime, { once: true });
                }
            }
        }
        updateTrackInfoUI();
    }

    function isAnyPageVideoPlaying() {
        try {
            const bgYtContainer = document.getElementById('bg-yt-container');
            const bgYtIframe = bgYtContainer ? bgYtContainer.querySelector('iframe') : null;

            // Se estiver na página do produto (qualquer formato de URL ou presença do container de slides)
            const isProductPage = window.location.href.includes('produto') || document.getElementById('product-slides-container') !== null;
            if (isProductPage) {
                const activeSlideTrailer = document.querySelector('#product-slides-container iframe, #product-slides-container video');
                if (activeSlideTrailer && activeSlideTrailer !== bgYtIframe) return true;
            }

            // Verifica qualquer iframe de trailer do YouTube fora do player de fundo
            const ytIframes = document.querySelectorAll('iframe[src*="youtube.com"], iframe[src*="youtu.be"]');
            for (let iframe of ytIframes) {
                if (iframe !== bgYtIframe && iframe.id !== 'bg-yt-player' && (!bgYtContainer || !bgYtContainer.contains(iframe))) {
                    return true;
                }
            }

            // Verifica elementos <video> ativos na página (fora do widget de música)
            const videos = document.querySelectorAll('video');
            for (let v of videos) {
                if (!v.closest('#bg-music-widget') && !v.paused && !v.ended) {
                    return true;
                }
            }

            const modalTrailer = document.querySelector('.modal iframe, .modal video');
            if (modalTrailer) return true;
        } catch(e){}
        return false;
    }

    function startPlayback() {
        const savedTime = parseFloat(sessionStorage.getItem('bg_music_time') || '0');
        loadTrack(currentTrackIndex, savedTime);

        if (isAnyPageVideoPlaying()) {
            pausedByVideo = true;
            updateUIState(false);
            return;
        }

        // Delay de 5 segundos ao entrar ou trocar de página antes de despausar e dar play com som
        setTimeout(() => {
            if (!isAnyPageVideoPlaying()) {
                userPaused = false;
                pausedByVideo = false;
                attemptPlay();
                window.__unmuteBgMusic();
            }
        }, 5000);
    }

    function attemptPlay() {
        if (userPaused || pausedByVideo || isAnyPageVideoPlaying()) return;
        const track = playlist[currentTrackIndex];
        if (!track) return;

        applyEffectiveVolume();

        if (isYoutubeUrl(track.url)) {
            if (audio) {
                audio.pause();
                audio.removeAttribute('src');
                audio.load();
            }
            const ytListId = getYoutubePlaylistId(track.url);
            const ytId = getYoutubeId(track.url);
            if (ytPlayer && isYtReady) {
                try {
                    if (userMuted && typeof ytPlayer.mute === 'function') ytPlayer.mute();
                    else if (!userMuted && typeof ytPlayer.unMute === 'function') ytPlayer.unMute();
                    
                    if (typeof ytPlayer.playVideo === 'function') {
                        ytPlayer.playVideo();
                    }
                    updateUIState(true);
                } catch(e) {
                    updateUIState(false, true);
                }
            } else {
                setTimeout(attemptPlay, 300);
            }
        } else {
            if (ytPlayer && isYtReady && typeof ytPlayer.pauseVideo === 'function') {
                try { ytPlayer.pauseVideo(); } catch(e){}
            }
            if (!audio || !audio.src) return;
            audio.muted = userMuted;
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    if (!audio.muted) {
                        isUnmutedAndPlaying = true;
                        removeActivityListeners();
                    }
                    updateUIState(!audio.paused && !audio.muted);
                }).catch(() => {
                    audio.muted = true;
                    audio.play().then(() => {
                        updateUIState(false, true);
                    }).catch(() => {
                        updateUIState(false, true);
                    });
                });
            }
        }
    }

    function playNextTrack() {
        userPaused = false;
        sessionStorage.setItem('bg_music_time', '0');
        const nextIndex = getNextTrackIndex();
        loadTrack(nextIndex, 0);
        attemptPlay();
    }

    function togglePlayPause() {
        const track = playlist[currentTrackIndex];
        if (!track) return;

        if (isYoutubeUrl(track.url)) {
            if (audio) {
                audio.pause();
                audio.removeAttribute('src');
                audio.load();
            }
            if (ytPlayer && isYtReady && typeof ytPlayer.getPlayerState === 'function') {
                const state = ytPlayer.getPlayerState();
                if (state === 1) {
                    userPaused = true;
                    ytPlayer.pauseVideo();
                    sessionStorage.setItem('bg_music_playing', 'false');
                    updateUIState(false);
                } else {
                    userPaused = false;
                    attemptPlay();
                }
            } else {
                userPaused = !userPaused;
                if (userPaused) {
                    updateUIState(false);
                } else {
                    attemptPlay();
                }
            }
        } else {
            if (ytPlayer && isYtReady && typeof ytPlayer.pauseVideo === 'function') {
                try { ytPlayer.pauseVideo(); } catch(e){}
            }
            if (!audio) return;
            if (audio.paused || audio.muted) {
                userPaused = false;
                userMuted = false;
                audio.muted = false;
                applyEffectiveVolume();
                const p = audio.play();
                if (p !== undefined) {
                    p.then(() => {
                        isUnmutedAndPlaying = true;
                        removeActivityListeners();
                        updateUIState(true);
                    }).catch(() => {});
                }
            } else {
                userPaused = true;
                audio.pause();
                sessionStorage.setItem('bg_music_playing', 'false');
                updateUIState(false);
            }
        }
    }

    function toggleMute() {
        const track = playlist[currentTrackIndex];
        userMuted = !userMuted;

        if (track && isYoutubeUrl(track.url) && ytPlayer && isYtReady) {
            if (userMuted) {
                if (typeof ytPlayer.mute === 'function') ytPlayer.mute();
            } else {
                if (typeof ytPlayer.unMute === 'function') ytPlayer.unMute();
            }
        } else if (audio) {
            audio.muted = userMuted;
            if (!userMuted && audio.paused && !userPaused) {
                audio.play().then(() => updateUIState(true)).catch(() => {});
            }
        }

        const muteBtn = document.getElementById('bg-music-mute-btn');
        if (muteBtn) {
            muteBtn.innerHTML = userMuted ? '🔇' : '🔊';
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
            bottom: 12px;
            right: 12px;
            z-index: 999999;
            font-family: 'Orbitron', system-ui, -apple-system, sans-serif;
            background: rgba(2, 6, 23, 0.95);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(59, 130, 246, 0.4);
            border-radius: 9999px;
            padding: 4px 8px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.8), 0 0 15px rgba(59, 130, 246, 0.25);
            color: #ffffff;
            display: flex;
            align-items: center;
            gap: 4px;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            user-select: none;
            max-width: calc(100vw - 16px);
            box-sizing: border-box;
        `;

        playerContainer.innerHTML = `
            <div id="bg-music-body" style="display: ${isMinimized ? 'none' : 'flex'}; align-items: center; gap: 5px; min-width: 0;">
                <div style="display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; background: rgba(59,130,246,0.15); border-radius: 50%; color: #38bdf8; font-size: 11px; flex-shrink: 0;">
                    🎵
                </div>
                <div style="max-width: clamp(55px, 18vw, 110px); overflow: hidden; white-space: nowrap; flex-shrink: 1;">
                    <div id="bg-music-title" style="font-size: 9px; font-weight: 600; color: #f8fafc; text-overflow: ellipsis; overflow: hidden;">
                        Carregando...
                    </div>
                    <div id="bg-music-subtitle" style="font-size: 7px; color: #94a3b8;">
                        ${isShuffle ? '🔀 Aleatório' : '🔁 Sequencial'}
                    </div>
                </div>
                <button id="bg-music-play-btn" style="background: #3b82f6; border: none; color: white; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; font-size: 10px; display: flex; align-items: center; justify-content: center; transition: transform 0.15s; flex-shrink: 0;" title="Play / Pause">
                    ▶
                </button>
                <button id="bg-music-next-btn" style="background: rgba(30,41,59,0.8); border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1; width: 22px; height: 22px; border-radius: 50%; cursor: pointer; font-size: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;" title="Próxima Música">
                    ⏭
                </button>
                
                <!-- Wrapper do botão Mute com Popup de Volume Slide -->
                <div id="bg-music-mute-wrapper" style="position: relative; display: flex; align-items: center; flex-shrink: 0;">
                    <button id="bg-music-mute-btn" style="background: transparent; border: none; color: #94a3b8; cursor: pointer; font-size: 11px; padding: 2px;" title="Mudar Volume / Mute">
                        ${userMuted || masterVolume === 0 ? '🔇' : '🔊'}
                    </button>
                    
                    <!-- Popover do Slide Sound (Barra de Volume para cima) -->
                    <div id="bg-music-volume-popover" style="position: absolute; bottom: 32px; right: 0; background: rgba(15, 23, 42, 0.96); border: 1px solid rgba(59, 130, 246, 0.5); backdrop-filter: blur(10px); padding: 8px 6px; border-radius: 10px; display: none; flex-direction: column; align-items: center; gap: 4px; box-shadow: 0 10px 25px rgba(0,0,0,0.9); z-index: 1000000; width: 32px;">
                        <span id="bg-music-vol-val-text" style="font-size: 8px; font-weight: bold; color: #38bdf8;">${Math.round(masterVolume * 100)}%</span>
                        <input type="range" id="bg-music-master-vol-slider" min="0" max="1" step="0.01" value="${masterVolume}" style="writing-mode: bt-lr; -webkit-appearance: slider-vertical; width: 6px; height: 70px; accent-color: #3b82f6; cursor: pointer;">
                    </div>
                </div>
            </div>
            <button id="bg-music-toggle-min" style="background: rgba(30,41,59,0.8); border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; width: 22px; height: 22px; border-radius: 50%; cursor: pointer; font-size: 9px; display: flex; align-items: center; justify-content: center; margin-left: 2px; shrink: 0;" title="Minimizar / Expandir">
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
                if (masterVolume === 0) {
                    userMuted = true;
                } else if (userMuted && masterVolume > 0) {
                    userMuted = false;
                }
                applyEffectiveVolume();
                const muteBtn = document.getElementById('bg-music-mute-btn');
                if (muteBtn) muteBtn.innerHTML = (userMuted || masterVolume === 0) ? '🔇' : '🔊';
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

        const currentTrack = playlist[currentTrackIndex];
        const isYtTrack = currentTrack ? isYoutubeUrl(currentTrack.url) : false;

        if (isYtTrack) {
            if (isBlocked) {
                playBtn.innerText = '▶';
                playBtn.style.background = '#e11d48';
                playBtn.title = 'Clique para ativar a música de fundo';
            } else if (isPlaying && !userPaused && !pausedByVideo) {
                playBtn.innerText = '❚❚';
                playBtn.style.background = '#10b981';
                playBtn.title = 'Pausar Músicas';
            } else {
                playBtn.innerText = '▶';
                playBtn.style.background = '#3b82f6';
                playBtn.title = 'Tocar Músicas';
            }
        } else {
            const isPlayingWithSound = isPlaying && audio && !audio.paused && !audio.muted;
            const isMutedByBrowser = audio && audio.muted && !userMuted && !audio.paused;

            if (isBlocked || isMutedByBrowser) {
                playBtn.innerText = '▶';
                playBtn.style.background = '#e11d48';
                playBtn.title = 'Clique para ativar a música de fundo';
            } else if (isPlayingWithSound) {
                playBtn.innerText = '❚❚';
                playBtn.style.background = '#10b981';
                playBtn.title = 'Pausar Músicas';
            } else {
                playBtn.innerText = '▶';
                playBtn.style.background = '#3b82f6';
                playBtn.title = 'Tocar Músicas';
            }
        }
    }

    // Auto-pausar música de fundo se algum vídeo de trailer/gameplay estiver rodando na página
    let activePlayingVideos = new Set();

    function updateVideoPauseState() {
        if (activePlayingVideos.size > 0) {
            if (typeof window.pauseBgMusic === 'function') {
                window.pauseBgMusic();
            }
        } else {
            if (typeof window.resumeBgMusic === 'function') {
                window.resumeBgMusic();
            }
        }
    }

    function setupGlobalVideoListeners() {
        document.addEventListener('play', (e) => {
            const target = e.target;
            if (target && target.tagName === 'VIDEO' && !target.closest('#bg-music-widget') && !target.closest('#bg-yt-container') && !target.closest('#admin-yt-test-container')) {
                activePlayingVideos.add(target);
                updateVideoPauseState();
            }
        }, true);

        document.addEventListener('pause', (e) => {
            const target = e.target;
            if (target && target.tagName === 'VIDEO' && !target.closest('#bg-music-widget') && !target.closest('#bg-yt-container') && !target.closest('#admin-yt-test-container')) {
                activePlayingVideos.delete(target);
                updateVideoPauseState();
            }
        }, true);

        document.addEventListener('ended', (e) => {
            const target = e.target;
            if (target && target.tagName === 'VIDEO' && !target.closest('#bg-music-widget') && !target.closest('#bg-yt-container') && !target.closest('#admin-yt-test-container')) {
                activePlayingVideos.delete(target);
                updateVideoPauseState();
            }
        }, true);

        const observer = new MutationObserver(() => {
            let changed = false;
            for (let v of activePlayingVideos) {
                if (typeof v === 'object' && v && v.tagName === 'VIDEO') {
                    if (!document.body.contains(v) || v.paused) {
                        activePlayingVideos.delete(v);
                        changed = true;
                    }
                }
            }
            if (changed) updateVideoPauseState();
        });
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        }

        window.addEventListener('message', (event) => {
            try {
                // Ignorar mensagens vindas do próprio player de música do YouTube do site
                const bgYtContainer = document.getElementById('bg-yt-container');
                const bgYtIframe = bgYtContainer ? bgYtContainer.querySelector('iframe') : null;
                const bgYtElement = document.getElementById('bg-yt-player');

                if (
                    (window.__bgYtWindow && event.source === window.__bgYtWindow) ||
                    (bgYtIframe && bgYtIframe.contentWindow === event.source) ||
                    (bgYtElement && bgYtElement.contentWindow === event.source)
                ) {
                    return;
                }

                let data = event.data;
                if (typeof data === 'string') {
                    try { data = JSON.parse(data); } catch(err) {}
                }

                if (data && typeof data === 'object') {
                    let state = undefined;
                    if (data.event === 'infoDelivery' && data.info && data.info.playerState !== undefined) {
                        state = data.info.playerState;
                    } else if (data.event === 'onStateChange' && data.info !== undefined) {
                        state = data.info;
                    } else if (data.info && data.info.playerState !== undefined) {
                        state = data.info.playerState;
                    }

                    const source = event.source;
                    if (state === 1) { // PLAYING (1)
                        activePlayingVideos.add(source);
                        updateVideoPauseState();
                    } else if (state === 2 || state === 0 || state === -1) { // PAUSED (2), ENDED (0), UNSTARTED (-1)
                        activePlayingVideos.delete(source);
                        updateVideoPauseState();
                    }
                }
            } catch(err) {}
        });
    }

    setupGlobalVideoListeners();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

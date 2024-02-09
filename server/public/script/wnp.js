// =======================================================
// WiiM Now Playing

// Namespacing
window.WNP = window.WNP || {};

// Default settings
WNP.s = {
    rndAlbumArtUri: "/img/fake-album-1.png",
    rndRadioArtUri: "/img/webradio-1.png"
};

// Data placeholders.
WNP.d = {
    serverSettings: null,
    deviceList: null,
    prevTransportState: null
}

/**
 * Initialisation of app.
 * @returns {undefined}
 */
WNP.Init = function () {
    console.log("WNP", "Initialising...");

    // Set Socket.IO definitions
    this.setSocketDefinitions();

    // Set UI event listeners
    this.setUIListeners();

    // Initial calls, wait a bit for socket to start
    setTimeout(() => {
        socket.emit("server-settings");
        socket.emit("devices-get");
    }, 500);

    // Create random album intervals, every 3 minutes
    rndAlbumInterval = setInterval(function () {
        WNP.s.rndAlbumArtUri = WNP.rndAlbumArt("fake-album-");
        WNP.s.rndRadioArtUri = WNP.rndAlbumArt("webradio-");
    }, 3 * 60 * 1000);

};

/**
 * Setting the listeners on the UI elements of the app.
 * @returns {undefined}
 */
WNP.setUIListeners = function () {
    console.log("WNP", "Set UI Listeners...")

    // Temporary not implemented message
    var toastBootstrap = bootstrap.Toast.getOrCreateInstance(liveToast)

    btnPrev.addEventListener("click", function () {
        toastBootstrap.show()
    });

    btnPlay.addEventListener("click", function () {
        toastBootstrap.show()
    });

    btnNext.addEventListener("click", function () {
        toastBootstrap.show()
    });

    // btnDevices.addEventListener("click", function () {
    //     socket.emit("devices-get");
    // });

    btnRefresh.addEventListener("click", function () {
        socket.emit("devices-refresh");
        // Wait for discovery to finish
        setTimeout(() => {
            socket.emit("devices-get");
            socket.emit("server-settings");
        }, 5000);
    });

    deviceChoices.addEventListener("change", function () {
        socket.emit("device-set", this.value);
    })

    btnReboot.addEventListener("click", function () {
        socket.emit("server-reboot");
    });

    btnShutdown.addEventListener("click", function () {
        socket.emit("server-shutdown");
    });

    btnReloadUI.addEventListener("click", function () {
        location.reload();
    });

};

/**
 * Set the socket definitions to listen for specific websocket traffic and handle accordingly.
 * @returns {undefined}
 */
WNP.setSocketDefinitions = function () {
    console.log("WNP", "Setting Socket definitions...")

    // On server settings
    socket.on("server-settings", function (msg) {

        // Store server settings
        WNP.d.serverSettings = msg

        // RPi has bash, so possibly able to reboot/shutdown.
        if (msg.os.userInfo.shell === "/bin/bash") {
            btnReboot.disabled = false;
            btnShutdown.disabled = false;
        };

        // Set device name
        if (msg.selectedDevice && msg.selectedDevice.friendlyName) {
            devName.innerText = msg.selectedDevice.friendlyName;
        };

    });

    // On devices get
    socket.on("devices-get", function (msg) {

        // Store and sort device list
        WNP.d.deviceList = msg;
        WNP.d.deviceList.sort((a, b) => { return (a.friendlyName < b.friendlyName) ? -1 : 1 });

        // Clear choices
        deviceChoices.innerHTML = "";

        // Add WiiM devices
        var devicesWiiM = WNP.d.deviceList.filter((d) => { return d.manufacturer.startsWith("Linkplay") });
        if (devicesWiiM.length > 0) {
            var optGroup = document.createElement("optgroup");
            optGroup.label = "WiiM devices";
            devicesWiiM.forEach((device) => {
                var opt = document.createElement("option");
                opt.value = device.location;
                opt.innerText = device.friendlyName;
                opt.title = "By " + device.manufacturer;
                if (WNP.d.serverSettings && WNP.d.serverSettings.selectedDevice && WNP.d.serverSettings.selectedDevice.location === device.location) {
                    opt.setAttribute("selected", "selected");
                };
                optGroup.appendChild(opt);
            })
            deviceChoices.appendChild(optGroup);
        };

        // Other devices
        var devicesOther = WNP.d.deviceList.filter((d) => { return !d.manufacturer.startsWith("Linkplay") });
        if (devicesOther.length > 0) {
            var optGroup = document.createElement("optgroup");
            optGroup.label = "Other devices";
            devicesOther.forEach((device) => {
                var opt = document.createElement("option");
                opt.value = device.location;
                opt.innerText = device.friendlyName;
                opt.title = "By " + device.manufacturer;
                if (WNP.d.serverSettings && WNP.d.serverSettings.selectedDevice && WNP.d.serverSettings.selectedDevice.location === device.location) {
                    opt.setAttribute("selected", "selected");
                };
                optGroup.appendChild(opt);
            })
            deviceChoices.appendChild(optGroup);

        };

        if (devicesWiiM.length == 0 && devicesOther.length == 0) {
            deviceChoices.innerHTML = "<option disabled=\"disabled\">No devices found!</em></li>";
        };

    });

    // On state
    socket.on("state", function (msg) {
        if (!msg) { return false; }
        // console.log(msg);

        // Get player progress data from the state message.
        var timeStampDiff = 0;
        if (msg.CurrentTransportState === "PLAYING") {
            timeStampDiff = (msg.stateTimeStamp && msg.metadataTimeStamp) ? Math.round((msg.stateTimeStamp - msg.metadataTimeStamp) / 1000) : 0;
        }
        var relTime = (msg.RelTime) ? msg.RelTime : "00:00:00";
        var trackDuration = (msg.TrackDuration) ? msg.TrackDuration : "00:00:00";

        // Get current player progress and set UI elements accordingly.
        var playerProgress = WNP.getPlayerProgress(relTime, trackDuration, timeStampDiff);
        progressPlayed.children[0].innerText = playerProgress.played;
        progressLeft.children[0].innerText = (playerProgress.left != "") ? "-" + playerProgress.left : "";
        progressPercent.setAttribute("aria-valuenow", playerProgress.percent)
        progressPercent.children[0].setAttribute("style", "width:" + playerProgress.percent + "%");

        // Player transport state changed...
        // Did the device start playing? Maybe fetch some new metadata.
        if (WNP.d.prevTransportState != msg.CurrentTransportState) {
            if (msg.CurrentTransportState === "PLAYING") {
                // TransportState changed to PLAYING! -> Should fetch new metadata immediately...
                btnPlay.children[0].classList.remove("bi-play-circle-fill")
                if (msg.PlayMedium && msg.PlayMedium === "RADIO-NETWORK") {
                    btnPlay.children[0].classList.remove("bi-pause-circle-fill");
                    btnPlay.children[0].classList.add("bi-stop-circle-fill");
                }
                else {
                    btnPlay.children[0].classList.remove("bi-stop-circle-fill");
                    btnPlay.children[0].classList.add("bi-pause-circle-fill");
                }
            }
            else if (msg.CurrentTransportState === "PAUSED_PLAYBACK" || msg.CurrentTransportState === "STOPPED") {
                btnPlay.children[0].classList.remove("bi-pause-circle-fill");
                btnPlay.children[0].classList.remove("bi-stop-circle-fill");
                btnPlay.children[0].classList.add("bi-play-circle-fill");
            }
            WNP.d.prevTransportState = msg.CurrentTransportState; // Remember the last transport state
        }

        // If internet radio, there is no skipping...
        if (msg.PlayMedium && msg.PlayMedium === "RADIO-NETWORK") {
            btnPrev.disabled = true;
            btnNext.disabled = true;
        }
        else {
            btnPrev.disabled = false;
            btnNext.disabled = false;
        }

    });

    // On metadata
    socket.on("metadata", function (msg) {
        if (!msg) { return false; }

        // Source detection
        playMedium = (msg.PlayMedium) ? msg.PlayMedium : "";
        trackSource = (msg.TrackSource) ? msg.TrackSource : "";
        sourceIdent = WNP.getSourceIdent(playMedium, trackSource);
        if (sourceIdent !== "") {
            var identImg = document.createElement("img");
            identImg.src = sourceIdent;
            identImg.alt = playMedium + ": " + trackSource;
            identImg.title = playMedium + ": " + trackSource;
            mediaSource.innerHTML = identImg.outerHTML;
        }
        else {
            mediaSource.innerText = playMedium + ": " + trackSource;
        }

        // Song Title, Subtitle, Artist, Album
        mediaTitle.innerText = (msg.trackMetaData && msg.trackMetaData["dc:title"]) ? msg.trackMetaData["dc:title"] : "";
        mediaSubTitle.innerText = (msg.trackMetaData && msg.trackMetaData["dc:subtitle"]) ? msg.trackMetaData["dc:subtitle"] : "";
        mediaArtist.innerText = (msg.trackMetaData && msg.trackMetaData["upnp:artist"]) ? msg.trackMetaData["upnp:artist"] + ", " : "";
        mediaAlbum.innerText = (msg.trackMetaData && msg.trackMetaData["upnp:album"]) ? msg.trackMetaData["upnp:album"] : "";

        // Audio quality
        songBitrate = (msg.trackMetaData && msg.trackMetaData["song:bitrate"]) ? msg.trackMetaData["song:bitrate"] : "";
        songBitDepth = (msg.trackMetaData && msg.trackMetaData["song:format_s"]) ? msg.trackMetaData["song:format_s"] : "";
        songSampleRate = (msg.trackMetaData && msg.trackMetaData["song:rate_hz"]) ? msg.trackMetaData["song:rate_hz"] : "";
        mediaBitRate.innerText = (songBitrate > 0) ? ((songBitrate > 1000) ? (songBitrate / 1000).toFixed(2) + " mbps, " : songBitrate + " kbps, ") : "";
        mediaBitDepth.innerText = (songBitDepth > 0) ? ((songBitDepth > 24) ? "24 bits, " : songBitDepth + " bits, ") : ""; // TODO: 32 bits is suspect according to the WiiM app?
        mediaSampleRate.innerText = (songSampleRate > 0) ? (songSampleRate / 1000).toFixed(1) + " kHz" : "";

        // Audio quality ident badge (HD/Hi-res/CD/...)
        songQuality = (msg.trackMetaData && msg.trackMetaData["song:quality"]) ? msg.trackMetaData["song:quality"] : "";
        songActualQuality = (msg.trackMetaData && msg.trackMetaData["song:actualQuality"]) ? msg.trackMetaData["song:actualQuality"] : "";
        qualiIdent = WNP.getQualityIdent(songQuality, songActualQuality, songBitrate, songBitDepth, songSampleRate);
        if (qualiIdent !== "") {
            mediaQualityIdent.innerText = qualiIdent;
            mediaQualityIdent.title = "Quality: " + songQuality + ", " + songActualQuality;
        }
        else {
            var identId = document.createElement("i");
            identId.classList.add("bi", "bi-soundwave", "text-secondary");
            identId.title = "Quality: " + songQuality + ", " + songActualQuality;
            mediaQualityIdent.innerHTML = identId.outerHTML;
        }

        // Album Art
        if (msg && msg.trackMetaData &&
            msg.trackMetaData["upnp:albumArtURI"] &&
            albumArt.src != msg.trackMetaData["upnp:albumArtURI"]) {
            if (msg.trackMetaData["upnp:albumArtURI"].startsWith("http")) {
                WNP.setAlbumArt(msg.trackMetaData["upnp:albumArtURI"]);
            }
            else {
                WNP.setAlbumArt(WNP.s.rndAlbumArtUri);
            }
        }
        else if (!msg || !msg.trackMetaData || !msg.trackMetaData["upnp:albumArtURI"]) {
            WNP.setAlbumArt(WNP.s.rndAlbumArtUri);
        }

        // Device volume
        devVol.innerText = (msg.CurrentVolume) ? msg.CurrentVolume : "-";

    });

    // On device set
    socket.on("device-set", function (msg) {
        // Device switch? Fetch settings and device info again.
        socket.emit("server-settings");
        socket.emit("devices-get");
    });

    // On device refresh
    socket.on("devices-refresh", function (msg) {
        deviceChoices.innerHTML = "<option disabled=\"disabled\">Waiting for devices...</em></li>";
    });

};

// =======================================================
// Helper functions

/**
 * Get player progress helper.
 * @param {string} relTime - Time elapsed while playing, format 00:00:00
 * @param {string} trackDuration - Total play time, format 00:00:00
 * @param {integer} timeStampDiff - Possible play time offset in seconds
 * @returns {object} An object with corrected played, left, total and percentage played
 */
WNP.getPlayerProgress = function (relTime, trackDuration, timeStampDiff) {
    var relTimeSec = this.convertToSeconds(relTime) + timeStampDiff;
    var trackDurationSec = this.convertToSeconds(trackDuration);
    if (trackDurationSec > 0 && relTimeSec < trackDurationSec) {
        var percentPlayed = Math.floor(relTimeSec / (trackDurationSec / 100));
        return {
            played: WNP.convertToMinutes(relTimeSec),
            left: WNP.convertToMinutes(trackDurationSec - relTimeSec),
            total: WNP.convertToMinutes(trackDurationSec),
            percent: percentPlayed
        };
    }
    else {
        return {
            played: "Live",
            left: "",
            total: "",
            percent: 0
        };
    };
};

/**
 * Convert time format '00:00:00' to total number of seconds.
 * @param {string} sDuration - Time, format 00:00:00.
 * @returns {integer} The number of seconds that the string represents.
 */
WNP.convertToSeconds = function (sDuration) {
    const timeSections = sDuration.split(":");
    let totalSeconds = 0;
    for (let i = 0; i < timeSections.length; i++) {
        nFactor = timeSections.length - 1 - i; // Count backwards
        nMultiplier = Math.pow(60, nFactor); // 60^n
        totalSeconds += nMultiplier * parseInt(timeSections[i]); // Calculate the seconds
    }
    return totalSeconds
}

/**
 * Convert number of seconds to '00:00' string format. 
 * Sorry for those hour+ long songs...
 * @param {integer} seconds - Number of seconds total.
 * @returns {string} The string representation of seconds in minutes, format 00:00.
 */
WNP.convertToMinutes = function (seconds) {
    var tempDate = new Date(0);
    tempDate.setSeconds(seconds);
    var result = tempDate.toISOString().substring(14, 19);
    return result;
};

/**
 * Sets the album art. Both on the foreground and background.
 * @param {integer} imgUri - The URI of the album art.
 * @returns {undefined}
 */
WNP.setAlbumArt = function (imgUri) {
    albumArt.src = imgUri;
    bgAlbumArtBlur.style.backgroundImage = "url('" + imgUri + "')";
};

/**
 * Come up with a random album art URI (locally from the img folder).
 * @param {string} prefix - The prefix for the album art URI, i.e. 'fake-album-' or 'webradio-'
 * @returns {string} An URI for album art
 */
WNP.rndAlbumArt = function (prefix) {
    return "/img/" + prefix + this.rndNumber(1, 5) + ".png";
};

/**
 * Get a random number between min and max, including min and max.
 * @param {integer} min - Minimum number to pick, keep it lower than max.
 * @param {integer} max - Maximum number to pick.
 * @returns {integer} The random number
 */
WNP.rndNumber = function (min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
};

/**
 * Get an identifier for the current play medium combined with the tracksource.
 * TODO: Verify all/most sources...
 * @param {string} playMedium - The PlayMedium as indicated by the device. Values: SONGLIST-NETWORK, RADIO-NETWORK, STATION-NETWORK, CAST, AIRPLAY, SPOTIFY, UNKOWN
 * @param {string} trackSource - The stream source as indicated by the device. Values: Prime, Qobuz, SPOTIFY, newTuneIn, iHeartRadio, Deezer, UPnPServer, Tidal, vTuner
 * @returns {string} The uri to the source identifier (image url)
 */
WNP.getSourceIdent = function (playMedium, trackSource) {

    var sIdentUri = "";

    switch (playMedium.toLowerCase()) {
        case "airplay":
            sIdentUri = "/img/sources/airplay.png";
            break;
        case "cast":
            sIdentUri = "/img/sources/chromecast.png";
            break;
        case "radio-network":
            sIdentUri = "/img/sources/radio.png";
            break;
        case "spotify":
            sIdentUri = "/img/sources/spotify.png";
            break;
    };

    switch (trackSource.toLowerCase()) {
        case "deezer":
            sIdentUri = "/img/sources/deezer.png";
            break;
        case "iheartradio":
            sIdentUri = "/img/sources/iheart.png";
            break;
        case "newtunein":
            sIdentUri = "/img/sources/newtunein.png";
            break;
        case "prime":
            sIdentUri = "/img/sources/amazon-music.png";
            break;
        case "qobuz":
            sIdentUri = "/img/sources/qobuz.png";
            break;
        case "tidal":
            sIdentUri = "/img/sources/tidal.png";
            break;
        case "upnpserver":
            sIdentUri = "/img/sources/dlna.png";
            break;
        case "vtuner":
            sIdentUri = "/img/sources/vtuner.png";
            break;
    };

    return sIdentUri;

};

/**
 * Get an identifier for the current audio/song quality.
 * TODO: Verify all/most sources...
 * Found so far:
 * 
 * CD Quality: 44.1 KHz/16 bit. Bitrate 1,411 kbps. For mp3 bitrate can vary, but also be 320/192/160/128/... kbps.
 * Hi-Res quality: 96 kHz/24 bit and up. Bitrate 9,216 kbps.
 * 
 * Spotify and Pandora usual bitrate 160 kbps, premium is 320 kbps
 * Tidal has CD quality, and FLAC, MQA, Master, ...
 * Qobuz apparently really has hi-res?
 * Amazon Music (Unlimited) does Atmos?
 * Apple Music -> Airplay 2, does hi-res?
 * YouTube Music -> Cast, does what?
 * 
 * TIDAL -
 * Sample High: "song:quality":"2","song:actualQuality":"LOSSLESS"
 * Sample MQA: "song:quality":"3","song:actualQuality":"HI_RES"
 * Sample FLAC: "song:quality":"4","song:actualQuality":"HI_RES_LOSSLESS"
 * 
 * @param {integer} songQuality - A number identifying the quality, as indicated by the streaming service(?).
 * @param {string} songActualQuality - An indicator for the actual quality, as indicated by the streaming service(?).
 * @param {integer} songBitrate - The current bitrate in kilobit per second.
 * @param {integer} songBitDepth - The current sample depth in bits.
 * @param {integer} songSampleRate - The current sample rate in Hz.
 * @returns {string} The identifier for the audio quality, just a string.
 */
WNP.getQualityIdent = function (songQuality, songActualQuality, songBitrate, songBitDepth, songSampleRate) {
    // console.log(songQuality, songActualQuality, songBitrate, songBitDepth, songSampleRate);

    var sIdent = "";

    if (songBitrate > 1000 && songBitDepth === 16 && songSampleRate === 44100) {
        sIdent = "CD";
    }
    else if (songBitrate > 9000 && songBitDepth >= 24 && songSampleRate >= 9600) {
        sIdent = "Hi-Res";
    }

    // Based of Tidal
    switch (songQuality + ":" + songActualQuality) {
        case "2:LOSSLESS":
            sIdent = "HIGH";
            break;
        case "3:HI_RES":
            sIdent = "MQA";
            break;
        case "4:HI_RES_LOSSLESS":
            sIdent = "FLAC";
            break;
    };

    return sIdent;

};

// =======================================================
// Starting the app

// Init Socket.IO
var socket = io();

// Start WiiM Now Playing app
WNP.Init();


"use strict";

window.addEventListener('DOMContentLoaded', function(e) {
    P.init();
})

var P = function() {

    let color_schemes = {
        "Default": "colorschemes/default.txt",
        "Dawnbringer": "https://manmademagic.github.io/DFColorGen/colorschemes/Dawnbringer.txt",
        "Lee's Colour Scheme": "https://manmademagic.github.io/DFColorGen/colorschemes/Lees_Colour_Scheme.txt",
        "Lee's Colour Scheme V2": "https://manmademagic.github.io/DFColorGen/colorschemes/Lees_Colour_Scheme-V2.txt"
    }

    let tilesets = {
        'Phoebus_16x16_Next.png': 'tilesets/Phoebus_16x16_Next.png',
        'Phoebus_16x16.png': 'tilesets/Phoebus_16x16.png',
        'Phoebus_16x16_TextBackground.png': 'tilesets/Phoebus_16x16_TextBackground.png',
        'Phoebus_16x16_TextClean.png': 'tilesets/Phoebus_16x16_TextClean.png',
        'Phoebus_16x16_text.png': 'tilesets/Phoebus_16x16_text.png',
        'Spacefox_16x16.png': 'tilesets/Spacefox_16x16.png',
        'Default': 'tilesets/curses_800x600.png'
    }

    let mov_files = {
        'Intro': 'movies/dwarf_fortress.cmv',
        'Bay12': 'movies/bay12games.cmv',
        'Toady': 'movies/toadyone.cmv',
        'Last_record': 'movies/last_record.cmv',
        'Mist': 'movies/mist.ccmv',
        '2005_01_huntbug.cmv': 'movies/2005_01_huntbug.cmv',
        '2005_02_huntbugb.cmv': 'movies/2005_02_huntbugb.cmv',
        '2005_03_huntbugc.cmv': 'movies/2005_03_huntbugc.cmv',
        '2005_04_huntbugd.cmv': 'movies/2005_04_huntbugd.cmv',
        '2005_05_huntbuge.cmv': 'movies/2005_05_huntbuge.cmv',
        '2005_06_huntbugf.cmv': 'movies/2005_06_huntbugf.cmv',
        '2005_07_huntbug7.cmv': 'movies/2005_07_huntbug7.cmv',
        '2005_08_huntbug8.cmv': 'movies/2005_08_huntbug8.cmv',
        '2005_09_huntbug9.cmv': 'movies/2005_09_huntbug9.cmv',
        '2005_10_spring10.cmv': 'movies/2005_10_spring10.cmv',
        '2005_11_spring11.cmv': 'movies/2005_11_spring11.cmv',
        '2005_12_summer12.cmv': 'movies/2005_12_summer12.cmv',
        '2005_13_summer13.cmv': 'movies/2005_13_summer13.cmv',
        '2005_14_autumn14.cmv': 'movies/2005_14_autumn14.cmv',
        '2005_15_autumn15.cmv': 'movies/2005_15_autumn15.cmv',
        '2005_16_winter16.cmv': 'movies/2005_16_winter16.cmv',
        '2005_17_winter17.cmv': 'movies/2005_17_winter17.cmv',
        '2005_18_spring18.cmv': 'movies/2005_18_spring18.cmv'
    }

    var channel = new MessageChannel();
    var cmv = new Worker('cmv.js');
    var rdr = new Worker('render.js');

    cmv.postMessage({
        event: "connect",
    },[ channel.port1 ]);

    rdr.postMessage({
        event: "connect",
    },[ channel.port2 ]);

    var player = null;

    var movies = {};
    let frames_count = 0;
    cmv.onmessage = function(e) {
        switch (e.data.event) {
            case 'movie_added':
                movies[e.data.movie.id] = e.data.movie;
                movies[e.data.movie.id].tracks = [];
                movies[e.data.movie.id].audios.forEach( (item, i) => {
                    movies[e.data.movie.id].tracks.push(new Audio('sound/' + item + '.ogg'))
                });
                break;
            case 'stopped':
                player.step_left.disabled = false;
                player.step_right.disabled = false;
                player.pause_btn.value = "⏵";
/*
                movies[movies.current_id].tracks.forEach( (item, i) => {
                    item.pause();
                });
*/
                break;
            case 'tick':
                player.slider.value = e.data.pos;
                break;
            case 'info_updated':
                frames_count = e.data.frames_count
                player.slider.max = e.data.frames_count - 1;
                console.log("Frames: ", e.data.frames_count)
                break;
        }
    }

    rdr.onmessage = function(e) {
        switch (e.data.event) {
            case 'play':
                player.slider.disabled = false;
                movies.current_id = e.data.id;
/*
                movies[e.data.id].a_ts.forEach( itez => {
                    setTimeout(function () {movies[e.data.id].tracks[itez[0]].play()}, itez[1] * 1000);
                });
*/
                player.style.width = e.data.width + 'px';
                player.step_left.disabled = true;
                player.step_right.disabled = true;
                player.pause_btn.value = "⏸";
                break;
            case 'resize':
                player.style.width = e.data.width + 'px';
                break;
        }
    }

    function init() {
        player = document.getElementById('cmv_player');
        player.style.width = '800px';
        player.canvas = document.createElement('canvas');
        player.canvas.id = 'cmv_canvas';
        player.canvas.width = 800;
        player.canvas.height = 300;

        const rdrCanvas = player.canvas.transferControlToOffscreen();
        rdr.postMessage({
            event: 'canvas',
            canvas: rdrCanvas
        },[rdrCanvas]);

        player.step_left = document.createElement('input');
        player.step_right = document.createElement('input');
        player.pause_btn = document.createElement('input');
        player.step_left.type = 'button';
        player.step_right.type = 'button';
        player.pause_btn.type = 'button';

        player.step_left.value = "<";
        player.step_right.value = ">";
        player.pause_btn.value = "⏵";

        player.colorscheme = document.createElement('select');
        for (const [key, value] of Object.entries(color_schemes)) {
            let option = document.createElement('option');
            option.value = value;
            option.textContent = key;
            player.colorscheme.appendChild(option);
        }

        rdr.postMessage({
            event: "colorscheme",
            src: player.colorscheme.selectedOptions[0].value
        });

        player.colorscheme.onchange = function() {
            var option = player.colorscheme.selectedOptions[0];
            rdr.postMessage({
                event: "colorscheme",
                src: option.value
            });
        };

        player.tileselect = document.createElement('select');
        for (const [key, value] of Object.entries(tilesets)) {
            let option = document.createElement('option');
            option.value = value;
            option.textContent = key;
            player.tileselect.appendChild(option);
        }

        rdr.postMessage({
            event: "tileset",
            src: player.tileselect.selectedOptions[0].value
        });

        player.tileselect.onchange = function() {
            var option = player.tileselect.selectedOptions[0];
            rdr.postMessage({
                event: "tileset",
                src: option.value
            });
        };

        player.movselect = document.createElement('select');
        for (const [key, value] of Object.entries(mov_files)) {
            let option = document.createElement('option');
            option.value = value;
            option.textContent = key;
            player.movselect.appendChild(option);
        }

        movies.current = player.movselect.selectedOptions[0].value;
        player.movselect.onchange = function() {
            var option = player.movselect.selectedOptions[0];
            movies.current = option.value;
            play(option.value);
       };

        player.step_left.onclick = function() {
            cmv.postMessage({
                event: 'seek',
                pos: '-1s'
            });
        };

        player.step_right.onclick = function() {
            cmv.postMessage({
                event: 'seek',
                pos: '1s'
            });
        };

        player.pause_btn.onclick = function() {
            play(movies.current);
        }
        player.canvas.addEventListener('click', function() {
            play(movies.current);
        }, false);

        player.canvas.addEventListener('onkeydown', function(e) {
            console.log(e)
        }, false);


        player.step_left.disabled = true;
        player.step_right.disabled = true;

        let slider = document.createElement('input');
        player.slider = slider;
        slider.type = 'range';
        slider.min = slider.value = 0;
        slider.max = 1000;
        slider.disabled = true;

        slider.oninput = slider.onchange = function() {
            cmv.postMessage({
                event: 'seek',
                pos: slider.value
            });

        };
/*
        slider.onmousedown = function() {
            mousedown = true;
        };
        slider.onmouseup = function() {
            mousedown = false;
        };
*/

        player.appendChild(player.movselect);
        player.appendChild(player.tileselect);
        player.appendChild(player.colorscheme);
        player.appendChild(player.canvas);
        player.appendChild(slider);
        player.appendChild(player.step_left);
        player.appendChild(player.step_right);
        player.appendChild(player.pause_btn);
    }

    function play(path) {
        cmv.postMessage({event: 'play', src: path});
    }

    return {
        init: init,
        play: play,
        stop: stop
    };

}();

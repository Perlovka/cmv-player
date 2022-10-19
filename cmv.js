
"use strict";

importScripts('zlib.min.js');

let rdr;

let movies = {};

self.onmessage = function(e) {
    switch (e.data.event) {
    case 'connect':
        rdr = e.ports[0];
        rdr.onmessage = onRdrMsg;
        break;
    case 'play':
        let id = sHash(e.data.src);
        if (movies[id]) {
            play(id);
        }
        else {
            getFile(e.data.src);
        }
        break;
    case 'seek':
        seek(e.data.pos);
        break;
    }
};

function sHash(s){
    for (var i=0, h=9; i<s.length;) {
        h = Math.imul(h^s.charCodeAt(i++),9**9);
    }
    return h^h>>>9;
}

function onRdrMsg(e) {
    console.log("Message from rdr: ", e.data)
}

async function getFile(src) {
    let file = await fetch(src);

    const reader = file.body.getReader();
    const chunks = [];
    let done, value;

    while (!done) {
        ({ value, done } = await reader.read());
        if (done) {
            let length = 0;
            chunks.forEach(item => {length += item.length;});
            let data = new Uint8Array(length);
            let offset = 0;

            chunks.forEach(item => {
                data.set(item, offset);
                offset += item.length;
            });

            decodeMovie(src, data.buffer);
            return
        }
        chunks.push(value);
    }
}

function decodeMovie(src, data) {
    let dv = new DataView(data)
    let id = sHash(src);

    var movie = {
        src:        src,
        version:    dv.getInt32(0, 1),
        columns:    dv.getInt32(4, 1),
        rows:       dv.getInt32(8, 1),
        delay:      dv.getInt32(12, 1),
        sounds:     0,
        s_files:    [],
        a_ts:       [],
        frames:     [],
        position:   0
    };

    movies[id] = movie;

    let index = 16
    if ( movie.version == 10001 ) {
        movie.sounds = dv.getInt32(index, 1);
        index += 4;
        // get sound filenames
        for (var i = index; i < (movie.sounds * 50);) {
            let name = new Uint8Array(data, i, 50);
            movie.s_files.push(String.fromCharCode.apply(String, name).replace(/\0.*/g,''));
            i += 50;
        }

        index += movie.sounds * 50;

        // get sounds timestamps
        let s_ids = new Uint32Array(data, index, 200 * 16);
        for (var k = 0; k < 200; k++) {
            for (var v = 0; v < 16; v++) {
                var ind = s_ids[k * 16 + v];
                if (ind !== 0xffffffff) {
                    movie.a_ts.push([ind, k * movie.delay / 100]);
                }
            }
        }
        index += 200 * 16 * 4
    }
    else {
        if (movie.version != 10000) {
            console.log("Unsupported version: ", movie.version);
            return;
        }
    }

    postMessage({
        event: 'movie_added',
        movie: {
            id: id,
            width: movie.columns,
            height: movie.rows,
            audios: movie.s_files,
            a_ts: movie.a_ts
        }
    })

    console.log("Metadata parsed: OK")
    console.log("Version:", movie.version)
    console.log("Columns:", movie.columns)
    console.log("Rows:", movie.rows)
    console.log("Delay:", movie.delay)
    console.log("Sounds count:", movie.sounds);
    console.log("Data starts at: ", index)

    let frame_size = movie.columns * movie.rows * 2
    console.log("Frame size: ", frame_size);

    // Chunk
    var chunk_l = dv.getInt32(index, 1);

    // unpack compressed chunks
    while (data.byteLength >= index + 4 + chunk_l) {
        var compressed = new Uint8Array(data, index + 4, chunk_l);
        var ddata = new Zlib.Inflate(compressed).decompress();

        var i = 0;
        var frame = null;
        // extract frames from chunk
        while ( ddata.byteLength >= i + frame_size) {
            frame = new Uint8Array(ddata.buffer, i, frame_size);
            movie.frames.push(frame);
            i += frame_size;
        }

        index += 4 + chunk_l;
        // out of range
        if (data.byteLength > index) {
            chunk_l = dv.getInt32(index, 1);
        }
    }

    console.log(movie)

    postMessage({
        event: 'info_updated',
        frames_count: movie.frames.length
    })

    play(id);
}

var intervalID;

function play(movie_id) {
    if (movies.playing) {
        stop();
        // paused
        if (movie_id == movies.current) {
            return
        }
        // movie changed
        movies[movie_id].position = 0;
    }

    rdr.postMessage({
        event: 'play',
        id: movie_id,
        width: movies[movie_id].columns,
        height: movies[movie_id].rows
    })

    // default 50 fps (+4 here for fine tuning intro)
    let delay = movies[movie_id].delay ? movies[movie_id].delay : 2;
    intervalID = setInterval(stream, delay * 1000 / (100 + 4), movie_id);
}

function seek(pos) {

    let position;

    if (isNaN(pos)) {
        let p = parseInt(pos, 10);
        position = movies[movies.current].position + p;
    }
    else {
        position = Number(pos);
    }

    if (position < 0 || position > (movies[movies.current].frames.length - 1)) {
        return;
    }

    rdr.postMessage({
        event: 'frame',
        data: movies[movies.current].frames[position]
    })
    postMessage({
        event: 'tick',
        pos: position
    })
    movies[movies.current].position = position;
}

function stream(movie_id) {
    let position = movies[movie_id].position;
    let frames_c = movies[movie_id].frames.length;

    movies.current = movie_id;
    movies.playing = true;

    rdr.postMessage({
        event: 'frame',
        data: movies[movie_id].frames[position]
    });

    postMessage({
        event: 'tick',
        pos: position
    })

    if (position < frames_c - 1) {
        movies[movie_id].position += 1;
    }
    else {
        stop();
        movies[movie_id].position = 0;
        postMessage({
            event: 'tick',
            pos: 0
        })
        rdr.postMessage({
            event: 'frame',
            data: movies[movie_id].frames[0]
        })
    }
}

function stop() {
    clearInterval(intervalID);
    movies.playing = false;
    postMessage({
        event: 'stopped'
    })
}

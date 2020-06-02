const express = require('express');
const child_process = require('child_process');
const worker_threads = require('worker_threads');

const config = require('./config.json');

function main() {
        let app = new express();
        app.use('/', express.static(`${__dirname}/webapps`));

        app.get(/^\/youtube\/parse$/, (req, res) => {
                let url = req._parsedUrl.query;
                console.log({op: '解析', url});

		let mr = url.match(/^https?:\/\/(?:youtu.be\/|www.youtube.com\/watch\?v=)([\w-]+)$/);
                if (!!!mr) {
                        console.log('reject');
                        res.send({
                          "error" : "请提供一个Youtube视频URL<br>例如：<br>https://www.youtube.com/watch?v=xxxxxxxxxxx",
                          "success" : false
                        });
                        return;
                }

                let thread = new worker_threads.Worker(__filename);
                thread.once('message', msg => {
			console.log({msg});
			res.send(msg);
                });
                thread.postMessage({op: 'parse', url, videoID: mr[1]});
        });

        app.listen(config.port, config.address, () => {
		console.log('服务已启动');
	});
}

function getAudio(id, format, rate, info, size) {
	return {id, format, rate, info, size};
}

function getVideo(id, format, scale, frame, rate, info, size) {
	return {id, format, scale, frame, rate, info, size};
}

function task() {
        worker_threads.parentPort.once('message', msg => {
                switch (msg.op) {
                        case 'parse': {
                                let audios = [], videos = [];
                                let bestAudio = {}, bestVideo = {};
                                let rs = child_process.execSync(`youtube-dl -F '${ msg.url }' 2> /dev/null`).toString().split('\n');
                                rs.forEach(it => {
					let videoRegex1 = /^(\d+)\s+(\w+)\s+(\d+x\d+)\s+(\d+)p\s+(\d+)k , (.*), video only, (.+)MiB$/;
					let mr = it.match(videoRegex1);
					if (!!mr) {
						console.log(getVideo(mr[1], mr[2], mr[3], mr[4], mr[5], mr[6]));
					}
                                });
				worker_threads.parentPort.postMessage({
					"success" : true,
					"result" : {
					    "v" : msg.videoID,
					    "best" : {
					      "audio" : bestAudio,
					      "video" : bestVideo,
					    },
					    "available" : {audios, videos}
					}
				});
                        }
                        case 'download': {
                        }
                }
        });
}

if (worker_threads.isMainThread)
        main();
else
        task();


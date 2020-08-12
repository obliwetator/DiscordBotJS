import ws from "ws";
import fs from "fs";
import https from "https";

export const server = https.createServer({
	cert: fs.readFileSync("/etc/letsencrypt/live/patrykstyla.com/fullchain.pem"),
	key: fs.readFileSync("/etc/letsencrypt/live/patrykstyla.com/privkey.pem"),
});

// const wss = new WebSocket.Server({ server ,path:"/ws"});
const wss = new ws.Server({ server }).on(
	"listening",
	() => {
		console.log("WS Server is ready");
	},
);

wss.on(
	"error",
	(error) => {
		console.log("Error", error);
	},
);
wss.on(
	"connection",
	(ws) => {
		// const id = setInterval(function () {
		//     ws.send(JSON.stringify(process.memoryUsage()), function () {
		//         //
		//         // Ignore errors.
		//         //
		//     });
		// }, 100);
		ws.on(
			"close",
			(a,b) => {
				console.log(`Client ${a} dissconnetced because ${b}`);
				// clearInterval(id);
			},
		);

		ws.on(
			"message",
			(message) => {
				console.log("Server received: %s", message);
				wss.clients.forEach((client) => {
					if (client !== ws && client.readyState === WebSocket.OPEN) {
						client.send(message);
					}
				});
			},
		);
	},
);

server.listen(8080);

import ws from "ws";
import fs from "fs";
import https from "https";
import { ctx } from "..";

export const server = https.createServer({
	cert: fs.readFileSync("/etc/letsencrypt/live/patrykstyla.com/fullchain.pem"),
	key: fs.readFileSync("/etc/letsencrypt/live/patrykstyla.com/privkey.pem"),
});

// const wss = new WebSocket.Server({ server ,path:"/ws"});
const wss = new ws.Server({ server })


wss.on("error", (error) => {
	console.log("Error", error);
});

wss.on("headers", (headers, request) => {

})

wss.on("close", () => {

})

wss.on("listening", () => {
	console.log("WS Server is ready");
})

function noop() { }

wss.on("connection", (ws, request) => {

	(ws as any).isAlive = true;
	// const id = setInterval(function () {
	//     ws.send(JSON.stringify(process.memoryUsage()), function () {
	//         //
	//         // Ignore errors.
	//         //
	//     });
	// }, 100);
	ws.on("pong", (data) => {
		(ws as any).isAlive = true
	})

	ws.on("ping", (data) => {

	})

	const interval = setInterval(function ping() {
		wss.clients.forEach(function each(ws) {
			if ((ws as any).isAlive === false) {
				console.log(ctx.red(`Websocket terminated due to innactivity: ${ws}`))
				return ws.terminate();
			}
			(ws as any).isAlive = false;
			ws.ping(noop);
		});
	}, 30000);

	ws.on("error", (error) => {
		console.log(`WS server error: ${error}`)
	})
	ws.on("close", (a, b) => {
		console.log(`Client ${a} dissconnetced because ${b}`);
		// clearInterval(id);
		clearInterval(interval);
	});

	ws.on("message", (message) => {
		console.log("Server received: %s", message);
		wss.clients.forEach((client) => {
			if (client !== ws && client.readyState === ws.OPEN) {
				client.send(message);
			}
		});
	});
});

server.listen(8080);


interface ExtWebSocket extends ws {
	isAlive: boolean;
}
import ws from "ws";
import { ctx } from "..";

export const WebSocket = new ws("wss://patrykstyla.com:8080");

WebSocket.on("open",() => {
    console.log(ctx.green('Bot socket is ready'))
	WebSocket.send("Bot socket is ready");
});

WebSocket.on("error", (error) => {
	console.log(ctx.redBright('Websocket error => ', error))
})

WebSocket.on("ping", (data) => {
    // console.log(ctx.green('Ping'))
})

WebSocket.on("pong", (data) => {
    // console.log(ctx.green('Pong'))
})

WebSocket.on("unexpected-response", (request, response) => {
	console.log(ctx.red('unexpected response'))
})

WebSocket.on("close", (code, reason) => {
	console.log(ctx.keyword('orange')(`Connection closed with code: ${code} and reason: ${reason}`))
})

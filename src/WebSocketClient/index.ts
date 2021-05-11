import ws from "ws";
import { ctx, client } from "..";

let WebSocket: ws

function connect() {
	WebSocket = new ws("wss://patrykstyla.com:9001")
	WebSocket.onopen = () => {
		console.log(ctx.green('Bot socket is ready'))
	};
	// Bot will receive messages from the webserver (for now to receive intercations data)
	WebSocket.onmessage =((event) => {
		console.log(event.data)
		client;
	})

	WebSocket.onerror = (event) => {
		// console.log(event)         
	}

	WebSocket.onclose = (event) => {
		setTimeout(() => {
			connect()	
		}, 1000);
	}
}

setInterval(() => {
	if (WebSocket.readyState === WebSocket.OPEN) {
		WebSocket.send("")
	}
}, 25000);

connect()
// TODO: send wraped in json 
function SendMessageToWebSocket(Encoded: Uint8Array, guild_id: string = "") {
	WebSocket.send(Encoded)
}

export { WebSocket, SendMessageToWebSocket }
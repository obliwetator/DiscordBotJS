import ws from "ws";
import fs from "fs";
import https from "https";
// import { ctx } from "..";
import { NIL as NIL_UUID } from 'uuid';
import uuid from 'uuid-random';

import { DEDICATED_COMPRESSOR_3KB, SHARED_COMPRESSOR, SSLApp } from "uWebSockets.js";
import { Message } from "discord.js";

const ChannelIDRegex = /(id) (\w{16,20})/
const RegexIsMessage = /message/

const BotIPV6Adress = new Set<string>(['0000:0000:0000:0000:0000:ffff:3359:fca7'])
const SubscribeMap = new Map<string, string>();

SSLApp({
	cert_file_name: "/etc/letsencrypt/live/patrykstyla.com/fullchain.pem",
	key_file_name: "/etc/letsencrypt/live/patrykstyla.com/privkey.pem",
}).ws('/*', {
	idleTimeout: 30,
	maxBackpressure: 1024,
	maxPayloadLength: 512,
	compression: SHARED_COMPRESSOR,

	upgrade: (res, req, context) => {
		res.upgrade({
			url: req.getUrl()
		},
			req.getHeader('sec-websocket-key'),
			req.getHeader('sec-websocket-protocol'),
			req.getHeader('sec-websocket-extensions'),
			context
		)
	},
	open: (ws) => {
		if (BotIPV6Adress.has(Buffer.from(ws.getRemoteAddressAsText()).toString())) {
			// console.log(ctx.blueBright("Bot connected"))
			console.log("bot connected")

			// This client is our bot
			ws.bot = true;
		}
	},
	message: (ws, message, isBinary) => {
		// Keep alive messages. Ignore	
		if(!message.byteLength){
			return
		}
		const DecMessage = Buffer.from(message).toString()

		if (ws.bot) {
			const JsonMessage = JSON.parse(DecMessage)
			if (JsonMessage.message) {
				ws.publish(JsonMessage.message.guild_id, message)
			}
		} else {
			const [, id, guild_id] = ChannelIDRegex.exec(DecMessage) || ['', '', '']
			// INDEX 0: whole string, 1: 'id', 2: id string
			if (guild_id) {
				ws.subscribe(guild_id);
			}
		}


		// ws.send((ws as any).uuid)
		// console.log(`Message: ${enc.decode(message)}`);
	},
	drain: (ws) => {
		console.log('WebSocket backpressure: ' + ws.getBufferedAmount());
	},
	close: (ws, code, message) => {
		console.log('WebSocket closed');
	},
}).listen(9001, (listenSocket) => {
	if (listenSocket) {
		console.log('Listening to port 9001');
	}
})


interface IBotMessage {
	message: {
		id: string
		guild_id: string
		channel_id: string
		content: string
		author: string
	}
}
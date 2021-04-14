import { GuildMember, Message, User, VoiceConnection, VoiceState } from "discord.js";
import DB from "../DB/DB";
import { WebSocket } from "../WebSocketClient";
import { DiscordBotJS } from "/home/ubuntu/DiscordBotJS/ProtoOutput/compiled";
import fs from "fs";
import FfmpegCommand from 'fluent-ffmpeg'
import { client, database } from '..';

const BossMusicFilePath = "/home/ubuntu/DiscordBotJS/audioClips/"

// voiceStateUpdate
/* Emitted whenever a user changes voice state - e.g. joins/leaves a channel, mutes/unmutes.
PARAMETER    TYPE             DESCRIPTION
oldMember    GuildMember      The member before the voice state update
newMember    GuildMember      The member after the voice state update    */
client.on("voiceStateUpdate", async (oldState, newState) => {
	// The only way for the properties to be undefined is either
	// 1) the user to connect for the first time
	// 2) the bot is connected after a user has joined ( not present in bot chache )
	if (newState.channel !== null) {
		// User is still present in the channel
		// Check what was the action
		if (oldState.channel === null) {
			// User Joins a voice channel FOR THE FIRST TIME
			database.AddVoiceState(EnumVoiceState.channel_join, newState.id!, newState.channelID!)
			// Plays when user joins a channel for the first time
			PlayBossMusic(newState, newState.member?.id!);
			SendWSVoiceState(DiscordBotJS.BotResponse.BotVoiceMessage.VoiceState.channel_join, newState)

			return;
		} else {
			// User switches channels or anything else
			await HandleVoiceState(oldState, newState, database);
		}
	} else if (newState.channel === null) {

		// User leaves a voice channel
		database.AddVoiceState(EnumVoiceState.channel_leave, newState.id!, oldState.channelID!)
		SendWSVoiceState(DiscordBotJS.BotResponse.BotVoiceMessage.VoiceState.channel_leave, newState)
	}
});

client.on('guildMemberSpeaking', async (guildMember, b) => {
	// Stopped speaking
	// if (b.bitfield === 0) {
	// 	console.log('b 0')
	// } else {
	// 	console.log('b 1')
	// 	// Speaking
	// 	if (client.voice) {
	// 		console.log('v 1')
	// 		if (client.voice.connections.has(guildMember.guild.id)) {
	// 			console.log('v v 1')
	// 			let connection = client.voice.connections.get(guildMember.guild.id)!
	// 			console.log(b);
	// 			let audioOutputFormat = 'ogg'
	// 			console.log(client.voice?.connections);
	// 			// Get the audio stream from discord for a certain user
	// 			const audio = connection.receiver.createStream(guildMember as GuildMember, { mode: 'pcm', end: 'manual' })
	// 			// Where the output will be stored
	// 			var stream = fs.createWriteStream(`/home/ubuntu/DiscordBotJS/audioClips/UserClips/${guildMember!.id}.${audioOutputFormat}`, {flags: 'a'})
		
	// 			// If we need the raw pcm audio data (s16le)
	// 			audio.pipe(fs.createWriteStream(`/home/ubuntu/DiscordBotJS/audioClips/UserClips/${guildMember!.id}`, {flags: 'a'}))
		
	// 			// Can use a file or in our case a stream
	// 			let command = FfmpegCommand(audio);
	// 			command.inputFormat('s16le')
	// 			// the other functions set the output options and it wont work otherwise
	// 			.inputOptions(['-ar 48000' , '-ac 2'])
	// 			// When using streams we must specify an output format
	// 			.outputFormat(audioOutputFormat)
	// 			// .on('start', function(commandLine) {
	// 			// 	console.log('Spawned Ffmpeg with command: ' + commandLine);
	// 			// })
	// 			// .on('end', function () {
	// 			// 	console.log('file has been converted succesfully');
	// 			// })
	// 			// .on('error', function (err) {
	// 			// 	console.log('an error happened: ' + err);
	// 			// })
	// 			.pipe(stream)
	// 		}
	// 	}
	// }
})

/**
 * Decides what was the action in the users voice state\
 * muted/defean... etc
 */
async function HandleVoiceState(oldState: VoiceState, newState: VoiceState, database: DB) {
	// User switches channels
	if (oldState.channel?.id !== newState.channel?.id) {
		PlayBossMusic(newState, newState.member?.id!)
		SendWSVoiceState(DiscordBotJS.BotResponse.BotVoiceMessage.VoiceState.channel_join, newState)

		return
	}
	// User is muted/defeaned in any way
	else if ((!oldState.selfDeaf && newState.selfDeaf) ||
		(!oldState.selfMute && newState.selfMute) ||
		(!oldState.serverDeaf && newState.serverDeaf) ||
		(!oldState.serverMute && newState.serverMute)) {
		// User was muted
		if (newState.selfMute && !oldState.selfMute) {
			database.AddVoiceState(EnumVoiceState.mute, newState.id!, newState.channelID!)

			SendWSVoiceState(DiscordBotJS.BotResponse.BotVoiceMessage.VoiceState.mute, newState)

		} else if (newState.serverMute && !oldState.serverMute) {
			const executor = await HandleVoiceStateExecutor(newState)
			database.AddVoiceState(EnumVoiceState.server_mute, newState.id!, newState.channelID!, executor)

			SendWSVoiceState(DiscordBotJS.BotResponse.BotVoiceMessage.VoiceState.server_mute, newState, executor)

		}
		// defeaned
		if (newState.selfDeaf && !oldState.selfDeaf) {
			database.AddVoiceState(EnumVoiceState.deaf, newState.id!, newState.channelID!)

			SendWSVoiceState(DiscordBotJS.BotResponse.BotVoiceMessage.VoiceState.deaf, newState)

		} else if (newState.serverDeaf && !oldState.serverDeaf) {
			const executor = await HandleVoiceStateExecutor(newState)
			database.AddVoiceState(EnumVoiceState.server_deaf, newState.id!, newState.channelID!, executor)

			SendWSVoiceState(DiscordBotJS.BotResponse.BotVoiceMessage.VoiceState.server_deaf, newState, executor)
		}

		return
	} else if ((oldState.selfDeaf && !newState.selfDeaf) ||
		(oldState.selfMute && !newState.selfMute) ||
		(oldState.serverDeaf && !newState.serverDeaf) ||
		(oldState.serverMute && !newState.serverMute)) {
		// user was unmuted
		if (!newState.selfMute && oldState.selfMute) {
			database.AddVoiceState(EnumVoiceState.unmute, newState.id!, newState.channelID!)

			SendWSVoiceState(DiscordBotJS.BotResponse.BotVoiceMessage.VoiceState.unmute, newState)

		} else if (!newState.serverMute && oldState.serverMute) {
			const executor = await HandleVoiceStateExecutor(newState)
			database.AddVoiceState(EnumVoiceState.server_unmute, newState.id!, newState.channelID!, executor)
			
			SendWSVoiceState(DiscordBotJS.BotResponse.BotVoiceMessage.VoiceState.server_unmute, newState, executor)

		}
		// undeafened
		if (!newState.selfDeaf && oldState.selfDeaf) {
			database.AddVoiceState(EnumVoiceState.undeafen, newState.id!, newState.channelID!)

			SendWSVoiceState(DiscordBotJS.BotResponse.BotVoiceMessage.VoiceState.undeafen, newState)

		} else if (!newState.serverDeaf && oldState.serverDeaf) {
			const executor = await HandleVoiceStateExecutor(newState)
			database.AddVoiceState(EnumVoiceState.server_undeafen, newState.id!, newState.channelID!, executor)

			SendWSVoiceState(DiscordBotJS.BotResponse.BotVoiceMessage.VoiceState.server_undeafen, newState)
		}

		return
	}

	if (newState.selfVideo && !oldState.selfVideo) {
		// User turned on webcam
		database.AddVoiceState(EnumVoiceState.video_start, newState.id!, newState.channelID!)
		SendWSVoiceState(DiscordBotJS.BotResponse.BotVoiceMessage.VoiceState.channel_join, newState)

		return;
	} else if (!newState.selfVideo && oldState.selfVideo) {
		// User turned off camera
		database.AddVoiceState(EnumVoiceState.video_stop, newState.id!, newState.channelID!)
		SendWSVoiceState(DiscordBotJS.BotResponse.BotVoiceMessage.VoiceState.channel_join, newState)

		return;
	}

	if (newState.streaming && !oldState.streaming) {
		// User started streaming
		database.AddVoiceState(EnumVoiceState.streaming_start, newState.id!, newState.channelID!)
		return;
	} else if (!newState.streaming && oldState.streaming) {
		// User stopped streaming
		database.AddVoiceState(EnumVoiceState.streaming_stop, newState.id!, newState.channelID!)
		return;
	}
}

async function HandleVoiceStateExecutor(newState: VoiceState): Promise<string | null> {
	const fetchedLogs = await newState.guild.fetchAuditLogs({
		limit: 1,
		type: 'MEMBER_UPDATE',
	});

	const UpdateLog = fetchedLogs.entries.first();

	if (!UpdateLog)
		return null;

	const { executor, target } = UpdateLog;

	// Check if the log was for that user
	if ((target as User).id === newState.id!) {
		return executor.id
	} else {
		return null
	}
}

function SendWSVoiceState(state: DiscordBotJS.BotResponse.BotVoiceMessage.VoiceState, newState: VoiceState, executor: string | null = null) {
	const State = DiscordBotJS.BotResponse.create({
		guild_id: newState.guild.id,
		id: newState.id,
		botVoiceMessage: {
			voice_state: state,
			channel_id: newState.channelID,
			executor: executor
		}
	})
	const Encoded = DiscordBotJS.BotResponse.encode(State).finish()
	WebSocket.send(Encoded)
}

export enum EnumVoiceState {
	mute,
	unmute,
	deaf,
	undeafen,
	server_mute,
	server_unmute,
	server_deaf,
	server_undeafen,
	video_start,
	video_stop,
	streaming_start,
	streaming_stop,
	channel_join,
	channel_leave,
}

// TODO: API to update/remove/add users
export const HasBossMusic: Map<string, string | null> = new Map();

async function EstablishConnection(songName: string, newState: VoiceState) {
	if (client.voice) {
		if (client.voice.connections.has(newState.guild.id)) {
			// Connected in tha guild re use the connection
			let connection = client.voice.connections.get(newState.guild.id)!

			if (connection.channel.id !== newState.channelID) {
				// different channel rejoin
				connection = await newState.member?.voice.channel?.join()!

				let stream = fs.createReadStream(BossMusicFilePath + songName);
				stream.on('error', (err) => {
					console.error('createReadStream error', err)
					newState.member?.send("I am an idiot");
					connection.disconnect()
					return;
				})
				const dispatcher = connection.play(stream, { volume: 1.5, type: 'ogg/opus' });
				dispatcher.on('start', () => {
				});
				dispatcher.on('finish', () => {
					// Disconnect when finished playing
					connection.disconnect()
				});
				// Always remember to handle errors appropriately!
				dispatcher.on('error', console.error);
			} else {
				// same channel
				let stream = fs.createReadStream(BossMusicFilePath + songName);
				stream.on('error', (err) => {
					console.error('createReadStream error', err);
					newState.member?.send("I am an idiot");
					connection.disconnect()
					return;
				})
				const dispatcher = connection.play(stream, { volume: 1.5, type: 'ogg/opus' });
				dispatcher.on('start', () => {
				});
				dispatcher.on('finish', () => {
					// Disconnect when finished playing
					connection.disconnect()
				});
				// Always remember to handle errors appropriately!
				dispatcher.on('error', console.error);
			}

		} else {
			// Not connected in that guild create new connection.

			// join the channel the user is in
			const connection = await newState.member?.voice.channel?.join()!
			// Create a dispatcher
			let stream = fs.createReadStream(BossMusicFilePath + songName);
			stream.on('error', (err) => {
				console.error('createReadStream error', err)
				newState.member?.send("I am an idiot");
				connection.disconnect();
				return;
			})
			const dispatcher = connection.play(stream, { volume: 1.5, type: 'ogg/opus' });
			dispatcher.on('start', () => {
			});
			dispatcher.on('finish', () => {
				// Disconnect when finished playing
				connection.disconnect()
			});
			// Always remember to handle errors appropriately!
			dispatcher.on('error', console.error);
		}
	} else {
		// no voice no gain
	}
}

/**
 * 
 * @param newState the voice state of the persion initializing the action (either through command or joing the chanmel)
 * @param target The id of the user for the song played
 * @param msgRef Used to reply to messages
 * @returns 
 */
export async function PlayBossMusic(newState: VoiceState, target: string, msgRef: Message | null = null) {
	if (HasBossMusic.has(target)) {
		// We have a match
		if (!HasBossMusic.get(target)) {
			// null return
			if (msgRef) {
				msgRef.reply("This user does not have boss music")
			}

			return
		}
		const songName = HasBossMusic.get(target)!;
		if (songName.length > 0) {
			// user has boss music
			EstablishConnection(songName, newState);
		} else {
			// no boss music for user return
			if (msgRef) {
				msgRef.reply("This user does not have boss music")
			}
			return;
		}
	} else {
		// no match go to db
		const result = await database.GetUserBossMusic(target)
		if (result.length > 0) {
			// we have a result
			HasBossMusic.set(target, result[0].song_name);
			EstablishConnection(result[0].song_name, newState);
		} else {
			// No boss music
			HasBossMusic.set(target, null);
			if (msgRef) {
				msgRef.reply("This user does not have boss music")
			}
		}
	}
}
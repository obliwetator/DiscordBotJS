
import { client, database } from "..";
import { User, VoiceState } from "discord.js";
import DB from "../DB/DB";
import { WebSocket } from "../WebSocketClient";
import { DiscordBotJS } from "/home/ubuntu/DiscordBotJS/ProtoOutput/compiled";

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
			PlayBossMusic(newState);
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

/**
 * Decides what was the action in the users voice state\
 * muted/defean... etc
 */
async function HandleVoiceState(oldState: VoiceState, newState: VoiceState, database: DB) {
	// User switches channels
	if (oldState.channel?.id !== newState.channel?.id) {
		PlayBossMusic(newState)
		SendWSVoiceState(DiscordBotJS.BotResponse.BotVoiceMessage.VoiceState.channel_join, newState)
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

function SendWSVoiceState(state: DiscordBotJS.BotResponse.BotVoiceMessage.VoiceState, newState: VoiceState, executor: string | null  = null) {
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

async function PlayBossMusic(newState: VoiceState) {
	if (newState.member?.id === "183931044829986817") {

		const connection = await newState.member?.voice.channel?.join()!

		// Create a dispatcher
		const dispatcher = connection.play('/home/ubuntu/DiscordBotJS/audioClips/Dark Souls III Soundtrack OST - Vordt of the Boreal Valley-[AudioTrimmer.com].mp3', { volume : 1.5 });

		dispatcher.on('start', () => {
		});

		dispatcher.on('finish', () => {
			// Disconnect when finished playing
			connection.disconnect()
		});

		// Always remember to handle errors appropriately!
		dispatcher.on('error', console.error);
	}
}
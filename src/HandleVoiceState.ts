import { VoiceState, User } from "discord.js"
import DB from "./DB/DB"

/**
 * Decides what was the action in the users voice state\
 * muted/defean... etc
 */
export async function HandleVoiceState(oldState: VoiceState, newState: VoiceState, database: DB) {
	// User is muted/defeaned in any way
	
	if ((!oldState.selfDeaf && newState.selfDeaf) ||
		(!oldState.selfMute && newState.selfMute) ||
		(!oldState.serverDeaf && newState.serverDeaf) ||
		(!oldState.serverMute && newState.serverMute)) {
		// User was muted
		if (newState.selfMute && !oldState.selfMute) {
			database.AddVoiceState(EnumVoiceState.mute, newState.member?.id!, newState.channelID!)
		} else if (newState.serverMute && !oldState.serverMute) {
			database.AddVoiceState(EnumVoiceState.server_mute, newState.member?.id!, newState.channelID!, await HandleVoiceStateExecutor(newState))
		}
		// defeaned
		if (newState.selfDeaf && !oldState.selfDeaf) {
			database.AddVoiceState(EnumVoiceState.deaf, newState.member?.id!, newState.channelID!)
		} else if (newState.serverDeaf && !oldState.serverDeaf) {
			database.AddVoiceState(EnumVoiceState.server_deaf, newState.member?.id!, newState.channelID!, await HandleVoiceStateExecutor(newState))
		}

		return
	} else if ((oldState.selfDeaf && !newState.selfDeaf) ||
		(oldState.selfMute && !newState.selfMute) ||
		(oldState.serverDeaf && !newState.serverDeaf) ||
		(oldState.serverMute && !newState.serverMute)) {
		// user was unmuted
		if (!newState.selfMute && oldState.selfMute) {
			database.AddVoiceState(EnumVoiceState.unmute, newState.member?.id!, newState.channelID!)
		} else if (!newState.serverMute && oldState.serverMute) {
			database.AddVoiceState(EnumVoiceState.server_unmute, newState.member?.id!, newState.channelID!, await HandleVoiceStateExecutor(newState))
		}
		// undeafened
		if (!newState.selfDeaf && oldState.selfDeaf) {
			database.AddVoiceState(EnumVoiceState.undeafen, newState.member?.id!, newState.channelID!)
		} else if (!newState.serverDeaf && oldState.serverDeaf) {
			database.AddVoiceState(EnumVoiceState.server_undeafen, newState.member?.id!, newState.channelID!, await HandleVoiceStateExecutor(newState))
		}

		return
	}

	if (newState.selfVideo && !oldState.selfVideo) {
		// User turned on webcam
		database.AddVoiceState(EnumVoiceState.video_start, newState.member?.id!, newState.channelID!)
		return;
	} else if (!newState.selfVideo && oldState.selfVideo) {
		// User turned off camera
		database.AddVoiceState(EnumVoiceState.video_stop, newState.member?.id!, newState.channelID!)
		return;
	}

	if (newState.streaming && !oldState.streaming) {
		// User started streaming
		database.AddVoiceState(EnumVoiceState.streaming_start, newState.member?.id!, newState.channelID!)
		return;
	} else if (!newState.streaming && oldState.streaming) {
		// User stopped streaming
		database.AddVoiceState(EnumVoiceState.streaming_stop, newState.member?.id!, newState.channelID!)
		return;
	}
}

async function HandleVoiceStateExecutor(newState: VoiceState): Promise<string> {
	const fetchedLogs = await newState.guild.fetchAuditLogs({
		limit: 1,
		type: 'MEMBER_UPDATE',
	});

	const UpdateLog = fetchedLogs.entries.first();

	if (!UpdateLog)
		return "";

	const { executor, target } = UpdateLog;

	// Check if the log was for that user
	if ((target as User).id === newState.id) {
		return executor.id
	} else {
		return ""
	}
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
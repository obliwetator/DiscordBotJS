
import { client, database } from "..";
import { User, VoiceState } from "discord.js";
import DB from "../DB/DB";


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
			// User Joins a voice channel
			database.AddVoiceState(EnumVoiceState.channel_join, newState.id, newState.channelID!)
			return;
		}
		HandleVoiceState(oldState, newState, database);
	} else if (newState.channel === null) {
		// User leaves a voice channel
		database.AddVoiceState(EnumVoiceState.channel_leave, newState.id, oldState.channelID!)
	}
});

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
import { CategoryChannel, DMChannel, GuildChannel, NewsChannel, StoreChannel, TextChannel, VoiceChannel } from "discord.js";
import { client, database, GetFetchLogsSingle } from "..";
import { LogTypes } from "../DB/DB";


// This fires every time the bot receives a message for the first time from the user since it's been started
// AND when a channel is created for the first time in a guild
// This event is unreliable with a DM channel. It creates a race condition with on."message" 
// which always finishes first for the first message sent
client.on("channelCreate", async (channel) => {
	const deletionLog = await GetFetchLogsSingle(channel, 'CHANNEL_CREATE');

	if (!deletionLog) {
		database.AddChannel(channel)
	} else {
		const { executor, target } = deletionLog;

		if ((target as GuildChannel).id === channel.id) {
			// Log matches the created channel
		}
		database.AddChannel(channel, executor.id)
	}
});

client.on("channelDelete", async (channel) => {
	const deletionLog = await GetFetchLogsSingle(channel, 'CHANNEL_DELETE');

	if (!deletionLog) {
		database.AddChannel(channel)
	} else {
		const { executor, target } = deletionLog;

		if ((target as GuildChannel).id === channel.id) {
			// Log matches the created channel
		}
		database.RemoveChannel(channel, executor.id);
	}
})

// channelUpdate
/* Emitted whenever a channel is updated - e.g. name change, topic change.
PARAMETER        TYPE        DESCRIPTION
oldChannel       Channel     The channel before the update
newChannel       Channel     The channel after the update    */
client.on("channelUpdate", (oldChannel, newChannel) => {
	// TODO: remove redudant check for one of the channels as both are guaranteed to be of the same type.
	// TODO: Add executor

	// TEXT
	if (oldChannel instanceof TextChannel && newChannel instanceof TextChannel) {
		if (oldChannel.rawPosition !== newChannel.rawPosition) {
			// Channel was moved in the guild hierarchy
			database.UpdateChannelPosition(newChannel.id, newChannel.rawPosition, newChannel.type);
		} else if (oldChannel.name !== newChannel.name) {
			database.UpdateChannelName(newChannel.id, newChannel.name, newChannel.type);
		} else if (oldChannel.permissionOverwrites !== newChannel.permissionOverwrites) {
			// permissionOverwrites is a Map with the roles that are being filtered
			// There will always be the @everyone role
			database.UpdateChannelPermissions(newChannel.id, oldChannel.permissionOverwrites, newChannel.permissionOverwrites)
		} else if (oldChannel.topic !== newChannel.topic) {
			database.UpdateTextChannelTopic(newChannel.id, newChannel.topic)
		} else if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
			database.UpdateTextChannelRateLimit(newChannel.id, newChannel.rateLimitPerUser)
		} else if (oldChannel.nsfw !== newChannel.nsfw) {
			database.UpdateTextChannelNsfw(newChannel.id, newChannel.nsfw);
		}
		// VOICE
	} else if (oldChannel instanceof VoiceChannel && newChannel instanceof VoiceChannel) {
		if (oldChannel.rawPosition !== newChannel.rawPosition) {
			// Channel was moved in the guild hierarchy
			database.UpdateChannelPosition(newChannel.id, newChannel.rawPosition, newChannel.type);
		} else if (oldChannel.name !== newChannel.name) {
			database.UpdateChannelName(newChannel.id, newChannel.name, "voice")
		} else if (oldChannel.bitrate !== newChannel.bitrate) {
			database.UpdateVoiceChannelBitrate(newChannel)
		} else if (oldChannel.userLimit !== newChannel.userLimit) {
			database.UpdateVoiceChannelUserLimit(newChannel)
		}
		// CATEGORY
	} else if (oldChannel instanceof CategoryChannel && newChannel instanceof CategoryChannel) {
		if (oldChannel.rawPosition !== newChannel.rawPosition) {
			// Channel was moved in the guild hierarchy
			database.UpdateChannelPosition(newChannel.id, newChannel.rawPosition, newChannel.type);
		} else if (oldChannel.name !== newChannel.name) {
			database.UpdateChannelName(newChannel.id, newChannel.name, "category")
		}
		// DM
	} else if (oldChannel instanceof DMChannel && newChannel instanceof DMChannel) {
		database.AddLog(`DM channel update + ${newChannel.toJSON()}`, LogTypes.channel)

		// STORE
	} else if (oldChannel instanceof StoreChannel && newChannel instanceof StoreChannel) {
		if (oldChannel.rawPosition !== newChannel.rawPosition) {
			// Channel was moved in the guild hierarchy
			database.UpdateChannelPosition(newChannel.id, newChannel.rawPosition, newChannel.type);
		} else if (oldChannel.name !== newChannel.name) {
			database.UpdateChannelName(newChannel.id, newChannel.name, "store")
		} // TODO: Rest of store 

		// NEWS
	} else if (oldChannel instanceof NewsChannel && newChannel instanceof NewsChannel) {
		if (oldChannel.rawPosition !== newChannel.rawPosition) {
			// Channel was moved in the guild hierarchy
			database.UpdateChannelPosition(newChannel.id, newChannel.rawPosition, newChannel.type);
		} else if (oldChannel.name !== newChannel.name) {
			database.UpdateChannelName(newChannel.id, newChannel.name, "news")
		} // TODO: Rest of news

	} else {
		database.AddLog("unkown channel at channelUpdate", LogTypes.guild)
	}
});



import { CategoryChannel, DMChannel, GuildChannel, NewsChannel, StoreChannel, TextChannel, User, VoiceChannel } from "discord.js";
import { client, database, GetFetchLogsSingle } from "..";
import { LogTypes } from "../DB/DB";
import { DiscordBotJS } from "/home/ubuntu/DiscordBotJS/ProtoOutput/compiled";
import { SendMessageToWebSocket } from "../WebSocketClient";


// This fires every time the bot receives a message for the first time from the user since it's been started
// AND when a channel is created for the first time in a guild
// This event is unreliable with a DM channel. It creates a race condition with on."message" 
// which always finishes first for the first message sent
client.on("channelCreate", async (channel) => {
	if (channel.type === "dm") {
		// DM channels are handled in the message listener
		return;
	}
	const deletionLog = await GetFetchLogsSingle(channel, 'CHANNEL_CREATE');
	let channelType: DiscordBotJS.BotResponse.BotChannelMessage.ChannelType = DiscordBotJS.BotResponse.BotChannelMessage.ChannelType.unkown

	if (!deletionLog) {
		database.AddChannel(channel, null, channelType)
	} else {
		const { executor, target } = deletionLog;

		if ((target as GuildChannel).id === channel.id) {
			// Log matches the created channel
		}
		database.AddChannel(channel, executor.id, channelType)
	}

	const ChannelCreate = DiscordBotJS.BotResponse.create({
		id: channel.id,
		guild_id: (channel as TextChannel).guild.id,
		botChannelMessage: {
			name: (channel as TextChannel).name,
			type: DiscordBotJS.BotResponse.BotChannelMessage.ChannelType.guild_text,
			action: DiscordBotJS.BotResponse.BotChannelMessage.Action.create
		}
	})
	const Encoded = DiscordBotJS.BotResponse.encode(ChannelCreate).finish()
	SendMessageToWebSocket(Encoded, (channel as TextChannel).guild.id);
});

client.on("channelDelete", async (channel) => {
	const deletionLog = await GetFetchLogsSingle(channel, 'CHANNEL_DELETE');
	let channelType: DiscordBotJS.BotResponse.BotChannelMessage.ChannelType = DiscordBotJS.BotResponse.BotChannelMessage.ChannelType.unkown

	if (!deletionLog) {
		database.AddChannel(channel, null, channelType)
	} else {
		const { executor, target } = deletionLog;

		if ((target as GuildChannel).id === channel.id) {
			// Log matches the created channel
			database.RemoveChannel(channel, executor.id);
		} else {
			// Unkown executor
			database.RemoveChannel(channel, null);	
		}
	}

	const ChannelCreate = DiscordBotJS.BotResponse.create({
		id: channel.id,
		guild_id: (channel as TextChannel).guild.id,
		botChannelMessage: {
			name: (channel as TextChannel).name,
			type: channelType,
			action: DiscordBotJS.BotResponse.BotChannelMessage.Action.delete
		}
	})
	const Encoded = DiscordBotJS.BotResponse.encode(ChannelCreate).finish()
	SendMessageToWebSocket(Encoded, (channel as TextChannel).guild.id);
})

// channelUpdate
/* Emitted whenever a channel is updated - e.g. name change, topic change.
PARAMETER        TYPE        DESCRIPTION
oldChannel       Channel     The channel before the update
newChannel       Channel     The channel after the update    */
client.on("channelUpdate", async (oldChannel, newChannel) => {
	const deletionLog = await GetFetchLogsSingle(newChannel, 'CHANNEL_UPDATE');
	
	let executor_target: string | null = null

	if (!deletionLog) {

	} else {
		const { executor, target } = deletionLog;

		if ((target as GuildChannel).id === newChannel.id) {
			// Log matches the created channel
			executor_target = executor.id;
		}
	}
	// TODO: Finalize what will go into the logs

	// TEXT
	if (oldChannel instanceof TextChannel) {
		if (oldChannel.rawPosition !== (newChannel as TextChannel).rawPosition) {
			// Channel was moved in the guild hierarchy
			database.UpdateChannelPosition((newChannel as TextChannel).id, (newChannel as TextChannel).rawPosition, (newChannel as TextChannel).type, executor_target);
		} else if (oldChannel.name !== (newChannel as TextChannel).name) {
			database.UpdateChannelName((newChannel as TextChannel).id, (newChannel as TextChannel).name, (newChannel as TextChannel).type, executor_target);
		} else if (oldChannel.permissionOverwrites !== (newChannel as TextChannel).permissionOverwrites) {
			// permissionOverwrites is a Map with the roles that are being filtered
			// There will always be the @everyone role
			database.UpdateChannelPermissions((newChannel as TextChannel).id, oldChannel.permissionOverwrites, (newChannel as TextChannel).permissionOverwrites, executor_target)
		} else if (oldChannel.topic !== (newChannel as TextChannel).topic) {
			database.UpdateTextChannelTopic((newChannel as TextChannel).id, (newChannel as TextChannel).topic, executor_target)
		} else if (oldChannel.rateLimitPerUser !== (newChannel as TextChannel).rateLimitPerUser) {
			database.UpdateTextChannelRateLimit((newChannel as TextChannel).id, (newChannel as TextChannel).rateLimitPerUser, executor_target)
		} else if (oldChannel.nsfw !== (newChannel as TextChannel).nsfw) {
			database.UpdateTextChannelNsfw((newChannel as TextChannel).id, (newChannel as TextChannel).nsfw, executor_target);
		}
		// VOICE
	} else if (oldChannel instanceof VoiceChannel) {
		if (oldChannel.rawPosition !== (newChannel as VoiceChannel).rawPosition) {
			// Channel was moved in the guild hierarchy
			database.UpdateChannelPosition((newChannel as VoiceChannel).id, (newChannel as VoiceChannel).rawPosition, (newChannel as VoiceChannel).type, executor_target);
		} else if (oldChannel.permissionOverwrites !== (newChannel as VoiceChannel).permissionOverwrites) {
			// permissionOverwrites is a Map with the roles that are being filtered
			// There will always be the @everyone role
			database.UpdateChannelPermissions((newChannel as VoiceChannel).id, oldChannel.permissionOverwrites, (newChannel as TextChannel).permissionOverwrites, executor_target)
		}  else if (oldChannel.name !== (newChannel as VoiceChannel).name) {
			database.UpdateChannelName((newChannel as VoiceChannel).id, (newChannel as VoiceChannel).name, "voice", executor_target)
		} else if (oldChannel.bitrate !== (newChannel as VoiceChannel).bitrate) {
			database.UpdateVoiceChannelBitrate((newChannel as VoiceChannel), executor_target)
		} else if (oldChannel.userLimit !== (newChannel as VoiceChannel).userLimit) {
			database.UpdateVoiceChannelUserLimit((newChannel as VoiceChannel), executor_target)
		}
		// CATEGORY
	} else if (oldChannel instanceof CategoryChannel) {
		if (oldChannel.rawPosition !== (newChannel as CategoryChannel).rawPosition) {
			// Channel was moved in the guild hierarchy
			database.UpdateChannelPosition((newChannel as CategoryChannel).id, (newChannel as CategoryChannel).rawPosition, (newChannel as CategoryChannel).type, executor_target);
		} else if (oldChannel.permissionOverwrites !== (newChannel as CategoryChannel).permissionOverwrites) {
			// permissionOverwrites is a Map with the roles that are being filtered
			// There will always be the @everyone role
			database.UpdateChannelPermissions((newChannel as CategoryChannel).id, oldChannel.permissionOverwrites, (newChannel as TextChannel).permissionOverwrites, executor_target)
		}  else if (oldChannel.name !== (newChannel as CategoryChannel).name) {
			database.UpdateChannelName((newChannel as CategoryChannel).id, (newChannel as CategoryChannel).name, "category", executor_target)
		}
		// DM
	} else if (oldChannel instanceof DMChannel) {
		database.AddLog(`DM channel update + ${newChannel.toJSON()}`, LogTypes.channel)

		// STORE
	} else if (oldChannel instanceof StoreChannel) {
		if (oldChannel.rawPosition !== (newChannel as StoreChannel).rawPosition) {
			// Channel was moved in the guild hierarchy
			database.UpdateChannelPosition((newChannel as StoreChannel).id, (newChannel as StoreChannel).rawPosition, (newChannel as StoreChannel).type, executor_target);
		} else if (oldChannel.permissionOverwrites !== (newChannel as StoreChannel).permissionOverwrites) {
			// permissionOverwrites is a Map with the roles that are being filtered
			// There will always be the @everyone role
			database.UpdateChannelPermissions((newChannel as StoreChannel).id, oldChannel.permissionOverwrites, (newChannel as TextChannel).permissionOverwrites, executor_target)
		}  else if (oldChannel.name !== (newChannel as StoreChannel).name) {
			database.UpdateChannelName((newChannel as StoreChannel).id, (newChannel as StoreChannel).name, "store", executor_target)
		}
		// NEWS
	} else if (oldChannel instanceof NewsChannel) {
		if (oldChannel.rawPosition !== (newChannel as NewsChannel).rawPosition) {
			// Channel was moved in the guild hierarchy
			database.UpdateChannelPosition((newChannel as NewsChannel).id, (newChannel as NewsChannel).rawPosition, (newChannel as NewsChannel).type, executor_target);
		} else if (oldChannel.permissionOverwrites !== (newChannel as NewsChannel).permissionOverwrites) {
			// permissionOverwrites is a Map with the roles that are being filtered
			// There will always be the @everyone role
			database.UpdateChannelPermissions((newChannel as NewsChannel).id, oldChannel.permissionOverwrites, (newChannel as TextChannel).permissionOverwrites, executor_target)
		}  else if (oldChannel.name !== (newChannel as NewsChannel).name) {
			database.UpdateChannelName((newChannel as NewsChannel).id, (newChannel as NewsChannel).name, "news", executor_target)
		}

	} else {
		database.AddLog("unkown channel at channelUpdate", LogTypes.guild)
	}
});
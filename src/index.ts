import { token } from "./Config";
import DB, { DEBUG_LOG_ENABLED, LogTypes } from "./DB/DB";
import { Channel, Client, Collection, TextChannel, PartialMessage, GuildMember, Role, User } from "discord.js";
import ws from "ws";
import { HandleVoiceState, EnumVoiceState } from "./HandleVoiceState";

import { obs } from "../timer";



// process.on("exit", () => {
// 	console.log('Bot Terminated') 
// 	client.destroy()
// })

// process.on("SIGINT", () => {
// 	console.log('Program exited')
//	client.destroy()
// process.exit() ;
// })

const database: DB = new DB();
const client = new Client({ partials: ['MESSAGE'] });
const DEBUG_ENABLED = false;

const WebSocket = new ws("wss://patrykstyla.com:8080");

WebSocket.on(
	"open",
	() => {
		WebSocket.send("Bot socket is ready");
	},
);

// ws.on('message', function incoming(data) {
//     console.log('Bot received: %s', data);
// });


async function handleGuild(): Promise<void> {
	const GuildKey = client.guilds.cache.firstKey();
	database.GuildId = GuildKey!;
	if (await database.FirstTimeInGuild(GuildKey!)) {
		database.AddGuild(
			client.guilds.cache.first()!,
			(client.channels.cache as Collection<string, TextChannel>),
		);
		console.log(`First time in ${client.guilds.cache.first()?.name}`)
	}
}

async function handleChannels(): Promise<void> {
	// Check if the chanels match up since last login
	const channels = await database.GetChannels(database.GuildId!);
	const ChannelsToAdd: Array<Channel> = [];
	client.channels.cache.forEach((element, key) => {
		if (!channels.has(key)) {
			// We don't have that channel added. Add it
			ChannelsToAdd.push(element);
		}
	});
	if (ChannelsToAdd.length > 0) {
		database.AddChannels(ChannelsToAdd);
		console.log(`Added new channels`)
	}
	// Update ALL channels when connecting to a server
	if (client.channels.cache.size > 0) {
		database.UpdateAllChannels(client.channels);
	}

}

async function handleUsers(): Promise<void> {
	const GuildMembers = await database.GetGuildUsers();
	const UsersToAdd: Array<GuildMember> = [];
	client.guilds.cache.first()?.members.cache.forEach((element, key) => {
		if (!GuildMembers.has(key)) {
			// We don't have that user. Add it
			UsersToAdd.push(element);
			GuildMembers.delete(key)
		}
		else {
			GuildMembers.delete(key)
		}
	});
	if (UsersToAdd.length > 0) {
		await database.AddUsers(UsersToAdd);
		database.AddGuildMembers(UsersToAdd);
	}
	// Remove any user that we itterate over.
	// Any User that's left is NOT present in the guild and has to be removed from the DB.
	if (GuildMembers.size > 0) {
		database.RemoveUsersFromGuild(GuildMembers)
	}

	if (client.users.cache.size > 0) {

	}

}

/**
 * 
 */
async function handleRoles(): Promise<void> {
	const Roles = await database.GetRoles();

	const RolesToAdd: Array<Role> = [];

	client.guilds.cache.first()?.roles.cache.forEach((element, key) => {
		if (!Roles.has(key)) {
			// We DON'T have that role in our db
			RolesToAdd.push(element);
			Roles.delete(key)
		}
		else {
			// We HAVE that role in our db
			Roles.delete(key)
		}
	});
	// Remove any role that we itterate over.
	// Any role that's left is NOT present in the guild and has to be removed from the DB.
	if (Roles.size > 0) {
		if (DEBUG_LOG_ENABLED.RoleDeletedFromGuild) {
			Roles.forEach((key) => {
				console.log(`Role id: ${key} has is not present in the guild anymore`)
			})
		}
		database.RemoveRoles(Roles)
	}
	// Add ALL the roles in the current guild.
	if (RolesToAdd.length > 0) {
		if (DEBUG_LOG_ENABLED.RoleAddedToGuild) {
			
		}
		await database.AddRoles(RolesToAdd);
	}
	database.UpdateAllRoles(client.guilds.cache.first()?.members.cache!);
}

client.on("ready", async () => {
	// register guild etc...
	handleGuild();
	// on joining check all channels since they bot is joining first time/ hasn't joined for a while
	handleChannels();
	// Check all users
	handleUsers();

	handleRoles();
	database.AddLog(`Logged in as ${client.user!.tag}!`, LogTypes.general_log);
	},
);

client.on(
	"channelCreate",
	(channel) => {
		if (channel.type === "text") {
			const TextChannel = (channel as TextChannel);
			database.AddChannels([TextChannel]);
			database.AddLog(`Text Channel Created:  ${TextChannel.name}`, LogTypes.channel);
		}
	},
);

// channelPinsUpdate
/* Emitted whenever the pins of a channel are updated. Due to the nature of the WebSocket event, not much information can be provided easily here - you need to manually check the pins yourself.
PARAMETER    TYPE         DESCRIPTION
channel      Channel      The channel that the pins update occurred in
time         Date         The time of the pins update    */
client.on("channelPinsUpdate", (channel, time) => {
	console.log(`channelPinsUpdate: ${channel}:${time}`);
});

// channelUpdate
/* Emitted whenever a channel is updated - e.g. name change, topic change.
PARAMETER        TYPE        DESCRIPTION
oldChannel       Channel     The channel before the update
newChannel       Channel     The channel after the update    */
client.on("channelUpdate", (oldChannel, newChannel) => {
	console.log(`channelUpdate -> a channel is updated - e.g. name change, topic change`);
});

// debug
/* Emitted for general debugging information.
PARAMETER    TYPE         DESCRIPTION
info         string       The debug information    */
if (DEBUG_ENABLED) {
	client.on("debug", (info) => {
		console.log(`debug -> ${info}`);
	});
}


// disconnect
/* Emitted when the client's WebSocket disconnects and will no longer attempt to reconnect.
PARAMETER    TYPE              DESCRIPTION
Event        CloseEvent        The WebSocket close event    */
client.on("disconnect", (event) => {
	console.log(`The WebSocket has closed and will no longer attempt to reconnect`);
});

// emojiCreate
/* Emitted whenever a custom emoji is created in a guild.
PARAMETER    TYPE          DESCRIPTION
emoji        Emoji         The emoji that was created    */
client.on("emojiCreate", (emoji) => {
	console.log(`a custom emoji is created in a guild`);
});

// emojiDelete
/* Emitted whenever a custom guild emoji is deleted.
PARAMETER    TYPE         DESCRIPTION
emoji        Emoji        The emoji that was deleted    */
client.on("emojiDelete", (emoji) => {
	console.log(`a custom guild emoji is deleted`);
});

// emojiUpdate
/* Emitted whenever a custom guild emoji is updated.
PARAMETER    TYPE       DESCRIPTION
oldEmoji     Emoji      The old emoji
newEmoji     Emoji      The new emoji    */
client.on("emojiUpdate", (oldEmoji, newEmoji) => {
	console.log(`a custom guild emoji is updated`);
});

/* Emitted whenever the client's WebSocket encounters a connection error.
PARAMETER    TYPE     DESCRIPTION
error        Error    The encountered error    */
client.on("error", (error) => {
	console.error(`client's WebSocket encountered a connection error: ${error}`);
});

// guildBanAdd
/* Emitted whenever a member is banned from a guild.
PARAMETER    TYPE          DESCRIPTION
guild        Guild         The guild that the ban occurred in
user         User          The user that was banned    */
client.on("guildBanAdd", (guild, user) => {
	console.log(`a member is banned from a guild`);
});

// guildBanRemove
/* Emitted whenever a member is unbanned from a guild.
PARAMETER    TYPE         DESCRIPTION
guild        Guild        The guild that the unban occurred in
user         User         The user that was unbanned    */
client.on("guildBanRemove", (guild, user) => {
	console.log(`a member is unbanned from a guild`);
});

// guildCreate
/* Emitted whenever the client joins a guild.
PARAMETER    TYPE         DESCRIPTION
guild        Guild        The created guild    */
client.on("guildCreate", (guild) => {
	console.log(`the client joins a guild`);
});

// guildDelete
/* Emitted whenever a guild is deleted/left.
PARAMETER    TYPE         DESCRIPTION
guild        Guild        The guild that was deleted    */
client.on("guildDelete", (guild) => {
	console.log(`the client deleted/left a guild`);
});

// guildMemberAdd
/* Emitted whenever a user joins a guild.
PARAMETER     TYPE               DESCRIPTION
member        GuildMember        The member that has joined a guild    */
client.on("guildMemberAdd", async (member) => {
	if (member.user) {
		// First add global user
		await database.AddUsers([member] as Array<GuildMember>);
		// Then add guild user
		database.AddGuildMembers([member] as Array<GuildMember>);
		database.AddLog(`a user joins a guild: ${member.id}`, LogTypes.guild_member)
	}
	else {
		database.AddLog("Guild member did not have a user?????", LogTypes.guild)
	}
});

// guildMemberRemove
/* Emitted whenever a member leaves a guild, or is kicked.
PARAMETER     TYPE               DESCRIPTION
member        GuildMember        The member that has left/been kicked from the guild    */
client.on("guildMemberRemove", (member) => {
	console.log(`a member leaves a guild, or is kicked: ${member.id} => ${member.displayName}`);
	// TODO Create dedicated function to delete only 1 user?
	const a = new Set(member.id);
	database.RemoveUsersFromGuild(a);
});

// guildMemberAvailable
/* Emitted whenever a member becomes available in a large guild.
PARAMETER     TYPE               DESCRIPTION
member        GuildMember        The member that became available    */
client.on("guildMemberAvailable", (member) => {
	console.log(`member becomes available in a large guild: ${member.id}`);
});

// guildMembersChunk
/* Emitted whenever a chunk of guild members is received (all members come from the same guild).
PARAMETER      TYPE                      DESCRIPTION
members        Array<GuildMember>        The members in the chunk
guild          Guild                     The guild related to the member chunk    */
client.on("guildMembersChunk", (members, guild) => {
	console.error(`a chunk of guild members is received`);
});

// guildMemberSpeaking
/* Emitted once a guild member starts/stops speaking.
PARAMETER     TYPE                DESCRIPTION
member        GuildMember         The member that started/stopped speaking
speaking      boolean             Whether or not the member is speaking    */
client.on("guildMemberSpeaking", (member, speaking) => {
	console.log(`a guild member starts/stops speaking: ${member.id}`);
});
// guildMemberUpdate
/* Emitted whenever a guild member changes - i.e. new role, removed role, nickname.
PARAMETER    TYPE               DESCRIPTION
oldMember    GuildMember        The member before the update
newMember    GuildMember        The member after the update    */
client.on("guildMemberUpdate", (oldMember, newMember) => {
	if (oldMember instanceof GuildMember && newMember instanceof GuildMember) {
		if (oldMember.nickname !== newMember.nickname) {
			// Avatar was changed
			console.log('Nickname changed')
		}
		else if (oldMember.roles.cache.size != newMember.roles.cache.size) {
			// Role was changed 
			if (oldMember.roles.cache.size > newMember.roles.cache.size) {
				// Role was removed
				let RemovedRole: string;
				for (const key of oldMember.roles.cache) {
					if (!oldMember.roles.cache.has(key[0])) {
						RemovedRole = key[0];
						database.RemoveGuildMemberRole(newMember.id, RemovedRole)
						break;
					}
				}
			} else {
				// role was added
				let AddedRole: string;
				for (const key of newMember.roles.cache) {
					if (!oldMember.roles.cache.has(key[0])) {
						AddedRole = key[0];
						database.AddGuildMemberRole(newMember.id, AddedRole)
						break;
					}
				}
			}
			console.log('Role changed')
		}
		else if (oldMember.user !== newMember.user) {
			console.log('User changed')
		}
	}
});

// guildUnavailable
/* Emitted whenever a guild becomes unavailable, likely due to a server outage.
PARAMETER    TYPE          DESCRIPTION
guild        Guild         The guild that has become unavailable    */
client.on("guildUnavailable", (guild) => {
	console.error(`a guild becomes unavailable, likely due to a server outage: ${guild}`);
});

// guildUpdate
/* Emitted whenever a guild is updated - e.g. name change.
PARAMETER     TYPE      DESCRIPTION
oldGuild      Guild     The guild before the update
newGuild      Guild     The guild after the update    */
client.on("guildUpdate", (oldGuild, newGuild) => {
	console.error(`a guild is updated`);
});

// messageDelete
/* Emitted whenever a message is deleted.
PARAMETER      TYPE           DESCRIPTION
message        Message        The deleted message    */
// Uses PartialMessage otherwise it won't fire for non-cached messages
client.on("messageDelete", async (message) => {
	console.log(`message is deleted -> ${message.id}`);
	// Ignore DM deletions
	if (!message.guild) 
	{
		database.DeleteMessage(message as PartialMessage);
		console.log('Priv Message Deleted');
		return;
	}

	database.DeleteMessage(message as PartialMessage);

	// const fetchedLogs = await message.guild.fetchAuditLogs({
	// 	limit: 1,
	// 	type: 'MESSAGE_DELETE',
	// });
	// const deletionLog = fetchedLogs.entries.first();
	// if (!deletionLog) {
	// 	database.DeleteMessage(message as PartialMessage);
	// 	return // No logs for this deletion
	// }

	return // No logs for this deletion

	// const { executor, target } = deletionLog;
	// if (deletionLog.id === message.id) {
	// 	// TODO: FIX
	// 	// We know who deleted the message
	// 	database.DeleteMessageExecutor(message as PartialMessage, executor.id, deletionLog.createdTimestamp);
	// } else {
	// 	// The log doesn't match up with the action.
	// 	// We don't know who deleted the message
	// 	database.DeleteMessage(message as PartialMessage);
	// }
});

// messageDeleteBulk
/* Emitted whenever messages are deleted in bulk.
PARAMETER    TYPE                              DESCRIPTION
messages     Collection<Snowflake, Message>    The deleted messages, mapped by their ID    */
// Uses PartialMessage otherwise it won't fire for non-cached messages
client.on("messageDeleteBulk", async (messages) => {
	const fetchedLogs = await messages.first()?.guild?.fetchAuditLogs({
		limit: 1,
		type: 'MESSAGE_BULK_DELETE',
	});

	const deletionLog = fetchedLogs?.entries.first();

	if (!deletionLog) {
		database.DeleteMessages(messages as Collection<string, PartialMessage>);
		return // No logs for this deletion
	}

	// const a = database.GetDeletionLogByTimestamp(deletionLog.createdTimestamp);

	if (false) {
		// TODO: FIX
		// No way to EASILY and reliably find who is the executor
		// It involves adding the timestamp and seeing if there is a different count of objects deletd
		// We know who deleted the message
		// database.DeleteMessagesExecutor(messages as Collection<string, PartialMessage>, deletionLog.executor.id, deletionLog.createdTimestamp);
	} else {
		// The log doesn't match up with the action.
		// We don't know who deleted the message
		database.DeleteMessages(messages as Collection<string, PartialMessage>);
	}

	messages.forEach((value, key) => {
		console.log("key => ", key, value)
	})
	database.DeleteMessages(messages as Collection<string, PartialMessage>);
});

// messageReactionAdd
/* Emitted whenever a reaction is added to a message.
PARAMETER              TYPE                   DESCRIPTION
messageReaction        MessageReaction        The reaction object
user                   User                   The user that applied the emoji or reaction emoji     */
client.on("messageReactionAdd", (messageReaction, user) => {
	console.log(`a reaction is added to a message`);
});

// messageReactionRemove
/* Emitted whenever a reaction is removed from a message.
PARAMETER              TYPE                   DESCRIPTION
messageReaction        MessageReaction        The reaction object
user                   User                   The user that removed the emoji or reaction emoji     */
client.on("messageReactionRemove", (messageReaction, user) => {
	console.log(`a reaction is removed from a message`);
});

// messageReactionRemoveAll
/* Emitted whenever all reactions are removed from a message.
PARAMETER          TYPE           DESCRIPTION
message            Message        The message the reactions were removed from    */
client.on("messageReactionRemoveAll", (message) => {
	console.error(`all reactions are removed from a message`);
});

// messageUpdate
/* Emitted whenever a message is updated - e.g. embed or content change.
PARAMETER     TYPE           DESCRIPTION
oldMessage    Message        The message before the update
newMessage    Message        The message after the update    */
client.on("messageUpdate", (oldMessage, newMessage) => {
	console.log(`a message is updated`);
});

// presenceUpdate
/* Emitted whenever a guild member's presence changes, or they change one of their details.
PARAMETER    TYPE               DESCRIPTION
oldMember    GuildMember        The member before the presence update
newMember    GuildMember        The member after the presence update    */
// client.on("presenceUpdate", (oldMember, newMember) => {
//     console.log(`a guild member's presence changes`);
// });

// roleCreate
/* Emitted whenever a role is created.
PARAMETER    TYPE        DESCRIPTION
role         Role        The role that was created    */
client.on("roleCreate", (role) => {
	console.error(`a role is created`);

});

// roleDelete
/* Emitted whenever a guild role is deleted.
PARAMETER    TYPE        DESCRIPTION
role         Role        The role that was deleted    */
client.on("roleDelete", (_role) => {
	console.error(`a guild role is deleted`);
});

// roleUpdate
/* Emitted whenever a guild role is updated.
PARAMETER      TYPE        DESCRIPTION
oldRole        Role        The role before the update
newRole        Role        The role after the update    */
client.on("roleUpdate", (oldRole, newRole) => {
	console.error(`a guild role is updated`);
});

// typingStart
/* Emitted whenever a user starts typing in a channel.
PARAMETER      TYPE            DESCRIPTION
channel        Channel         The channel the user started typing in
user           User            The user that started typing    */
client.on("typingStart", (channel, user) => {
	console.log(`${user.id} has started typing`);

});

// userUpdate
/* Emitted whenever a user's details (e.g. username) are changed.
PARAMETER      TYPE        DESCRIPTION
oldUser        User        The user before the update
newUser        User        The user after the update    */

// guildMemberUpdate fires when userUpdate fires but not the other way around
// In other words all the updates will be available under guildMemberUpdate listener
// client.on("userUpdate", (oldUser, newUser) => {
// 	console.log(`user's details (e.g. username) are changed`);
// });

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
		HandleVoiceState(oldState, newState, database);
		// User is still present in the channel
		// Check what was the action
		if (oldState.channel === null) {
			// User Joins a voice channel
			database.AddVoiceState(EnumVoiceState.channel_join, newState.id, newState.channelID!)
		}
	} else if (newState.channel === null) {
		// User leaves a voice channel
		database.AddVoiceState(EnumVoiceState.channel_leave, newState.id, oldState.channelID!)
	}
});

// warn
/* Emitted for general warnings. 
PARAMETER    TYPE       DESCRIPTION
info         string     The warning   */
client.on("warn", (info) => {
	console.log(`warn: ${info}`);
});

client.on(
	"message",
	(msg) => {
		// Ignore own messages
		// This can cause infinte loops
		if (msg.author.id === client.user?.id)
		{
			database.AddMessageDM(msg);
			return;
		}
			
		// Private messages.
		// TODO: anything?
		if (msg.channel.type === "dm") {
			database.AddMessageDM(msg);
			msg.reply("Some placeholder functionality");
			return;
		}
		// console.log('Raw message', msg)
		if (msg.channel.type === "text") {
			database.AddMessage(msg);
			// send the message to all clients
			WebSocket.send(msg.content);
		}
	},
);

client.login(token);


client.on("rateLimit" , (a) => {
	console.log('RATE LIMIT', a);
})
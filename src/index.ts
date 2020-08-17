import { token } from "./Config";
import DB, { LogTypes } from "./DB/DB";
import { Channel, Client, Collection, TextChannel, User, Message, PartialMessage, VoiceChannel } from "discord.js";
import ws from "ws";
import { HandleVoiceState } from "./HandleVoiceState";

// process.on("exit", () => {
// 	console.log('Bot Terminated') 
// 	client.destroy()
// })

// process.on("SIGINT", () => {
// 	console.log('Program exited')
// 	client.destroy()
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
	let GuildKey = client.guilds.cache.firstKey();
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
	let channels = await database.GetChannels(database.GuildId!);
	let ChannelsToAdd: Array<Channel> = [];
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
	let GuildUsers = await database.GetGuildUsers();
	let UsersToAdd: Array<User> = [];
	client.users.cache.forEach((element, key) => {
		if (!GuildUsers.has(key)) {
			// We don't have that user. Add it
			UsersToAdd.push(element);
		}
	});
	if (UsersToAdd.length > 0) {
		database.AddUsers(UsersToAdd);
		console.log('Added new users')
	}

	if (client.users.cache.size > 0) {

	}

}

client.on(
	"ready",
	async () => {
		// register guild etc...
		handleGuild();
		// on joining check all channels since they bot is joining first time/ hasn't joined for a while
		handleChannels();
		// Check all users
		handleUsers();
		database.AddLog(`Logged in as ${client.user!.tag}!`, LogTypes.general_log);
	},
);

client.on(
	"channelCreate",
	(channel) => {
		if (channel.type === "text") {
			let TextChannel = (channel as TextChannel);
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
client.on("guildMemberAdd", (member) => {
	if (member.user) {
		database.AddUsers([member.user]);
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
	database.RemoveUserFromGuild(member);
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
	console.error(`a guild member changes - i.e. new role, removed role, nickname.`);
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
client.on("messageDelete", (message) => {
	console.log(`message is deleted -> ${message}`);

	database.DeleteMessage(message as PartialMessage);
});

// messageDeleteBulk
/* Emitted whenever messages are deleted in bulk.
PARAMETER    TYPE                              DESCRIPTION
messages     Collection<Snowflake, Message>    The deleted messages, mapped by their ID    */
// Uses PartialMessage otherwise it won't fire for non-cached messages
client.on("messageDeleteBulk", (messages) => {
	messages.forEach((value, key) => {
		console.log("key => ", key)
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
client.on("roleDelete", (role) => {
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
client.on("userUpdate", (oldUser, newUser) => {
	console.log(`user's details (e.g. username) are changed`);
});

// voiceStateUpdate
/* Emitted whenever a user changes voice state - e.g. joins/leaves a channel, mutes/unmutes.
PARAMETER    TYPE             DESCRIPTION
oldMember    GuildMember      The member before the voice state update
newMember    GuildMember      The member after the voice state update    */
client.on("voiceStateUpdate", async (oldState, newState) => {
	console.log(`a user changes voice state`);
	// The only way for the properties to be undefined is either
	// 1) the user to connect for the first time
	// 2) the bot is connected after a user has joined ( not present in bot chache )

	// const fetchedLogs = await newState.guild.fetchAuditLogs({
	// 	limit: 1,
	// 	type: 'MEMBER_UPDATE',
	// });
	// const { executor, target } = fetchedLogs.entries.first()!;

	// if (!fetchedLogs) {
	// 	// No logs. We don't know who performed the action
	// }
	if (newState.channel !== null) {
		HandleVoiceState(oldState, newState);

		// User is still present in the channel
		// Check what was the action
		if (oldState.channel === null) {
			// User Joins a voice channel
			console.log('User joined channel')
		}
	} else if (newState.channel === null) {
		// User leaves a voice channel
		console.log('User left channel')
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
		if (msg.author.bot) return;
		// Private messages.
		// TODO: anything?
		if (msg.channel.type === "dm") {
			msg.reply("Some placeholder functionality");
			return
		}
		// console.log('Raw message', msg)
		if (msg.channel.type === "text") {
			database.AddMessage(msg);
			console.log(`message content. id: ${msg.id} -> ${msg.content}`)
			// send the message to all clients
			WebSocket.send(msg.content);
		}
	},
);

client.login(token);


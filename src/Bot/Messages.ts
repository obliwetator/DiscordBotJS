// messageDelete
/* Emitted whenever a message is deleted.
PARAMETER      TYPE           DESCRIPTION
message        Message        The deleted message    */

import { Collection, Message, PartialMessage } from "discord.js";
import { client, ctx, database, GetFetchLogsSingle } from "..";
import { WebSocket } from "../WebSocketClient";
WebSocket

/** MAYBE: Add timeout to delete old entires to prevent a very large data set */
const DMChanellsSet = new Set<string>();

// Uses PartialMessage otherwise it won't fire for non-cached messages
client.on("messageDelete", async (message) => {
	// Ignore DM deletions
	if (!message.guild) {
		database.DeleteMessage(message as PartialMessage);
		console.log('Priv Message Deleted');
		return;
	}

	const deletionLog = await GetFetchLogsSingle(message, 'MESSAGE_DELETE');

	if (!deletionLog) {
		database.DeleteMessage(message as PartialMessage);
	} else {
		const { executor, target } = deletionLog;

		if ((target as PartialMessage).id === message.id) {
			// Log matches the created channel
			database.DeleteMessage(message as PartialMessage, executor.id);
		} else {
			// TODO: We don't know the author of the message if it is not cached.
			// There is a chance we have that message in our db and know the author
			// In this case we can safelly find the executor.
			// REMINDER: own mesage deletion WILL NOT TRIGGER ANY LOGS
			database.DeleteMessage(message as PartialMessage);
		}
	}
	console.log(`message is deleted -> ${message.id}`);

	return
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

// messageUpdate
/* Emitted whenever a message is updated - e.g. embed or content change.
PARAMETER     TYPE           DESCRIPTION
oldMessage    Message        The message before the update
newMessage    Message        The message after the update   
Realisticallty only the message content will be changed by a user.
Bots can eddit embeds and attachments but that wont be supported(?)
*/
client.on("messageUpdate", async (oldMessage, newMessage) => {
	if (oldMessage.content === null) {
		// Updating messages that are not cached do not generate any data(expect ID) for oldMessage
		// Try to find the message in our DB
		const DBMessage = await database.GetMessage(newMessage.id);
		if (!DBMessage[0]) {
			// There is a very high possiblity that no fields will be returned
			// TODO: There is a possibility the user was not recorded when the message was sent
			// AND that user is no longer in the channel(and) causing an error
			if (!newMessage.author)
				newMessage = await newMessage.fetch()

			// We don't have that message in our DB
			// Add the new message(edit) as is.
			database.AddMessage(newMessage as Message);
		} else {
			// we have the message. Update it and add a log
			database.UpdateMessage(DBMessage[0], newMessage as Message);
		}
	}
	if (oldMessage.content !== newMessage.content) {
		database.UpdateMessageAPI(oldMessage as Message, newMessage as Message);
		// Content was changed
	} else if (oldMessage.pinned !== newMessage.pinned) {
		// Message was pinned/unpinned
		if (newMessage.pinned) {
			// Pinned
		} else {
			// Unpinned
		}
	}
});

client.on("message", async (msg) => {
	// Ignore own messages. This can cause infinte loops
	if (msg.author.id === client.user?.id) {
		database.AddMessageDM(msg);
		return;
	}
	// Private messages.
	if (msg.channel.type === "dm") {
		// Check if we have that channel in our DB from a local state
		if (DMChanellsSet.has(msg.channel.id)) {
			// We have the channel. Add the message to the DB
			database.AddMessageDM(msg);
		} else {
			// Query DB and add the result to the local state
			let DMChannelFromDB = await database.GetDMChannel(msg.channel)
			if (DMChannelFromDB[0]) {
				// We have that channel in our DB
			} else {
				// We don't have the chanel. Add it
				//await database.AddChannels([msg.channel])
				await database.AddDMChannel(msg.channel);
			}
			DMChanellsSet.add(msg.channel.id)

			database.AddMessageDM(msg);
		}
		msg.reply("Some placeholder functionality");
		return;
	}
	if (msg.type === "DEFAULT") {
		database.AddMessage(msg);
		// send the message to all clients
		WebSocket.send(JSON.stringify({
			message:
			{
				id: msg.id,
				guild_id: msg.guild?.id,
				channel_id: msg.channel.id,
				content: msg.content,
				author: msg.author.id
			}
		}));

		return;
	} else if (msg.type === "PINS_ADD") {
		database.UpdateChannelPins(msg);
	} else {
		ctx.redBright(`Unimplemented type`)
		throw new Error(`"Method not implemented. Type: ${msg.type}"`);
	}

	return;
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

// typingStart
/* Emitted whenever a user starts typing in a channel.
PARAMETER      TYPE            DESCRIPTION
channel        Channel         The channel the user started typing in
user           User            The user that started typing    */
client.on("typingStart", (channel, user) => {
	console.log(`${user.id} has started typing`);

});
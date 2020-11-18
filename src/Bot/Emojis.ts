import { GuildEmoji } from "discord.js";
import { client, database } from "..";


// emojiCreate
/* Emitted whenever a custom emoji is created in a guild.
PARAMETER    TYPE          DESCRIPTION
emoji        Emoji         The emoji that was created    */
client.on("emojiCreate", async (emoji) => {
	const executor = await EmojiLogs(emoji, 'EMOJI_CREATE');
	database.AddEmoji(emoji, executor);
});

// emojiDelete
/* Emitted whenever a custom guild emoji is deleted.
PARAMETER    TYPE         DESCRIPTION
emoji        Emoji        The emoji that was deleted    */
client.on("emojiDelete", async (emoji) => {
	const executor = await EmojiLogs(emoji, 'EMOJI_DELETE');
	database.RemoveEmoji(emoji.id, executor)
});

// emojiUpdate
/* Emitted whenever a custom guild emoji is updated.
PARAMETER    TYPE       DESCRIPTION
oldEmoji     Emoji      The old emoji
newEmoji     Emoji      The new emoji    */
client.on("emojiUpdate", async (oldEmoji, newEmoji) => {
	// They only thing that can be changed in emojis is the name(?)
	const executor = await EmojiLogs(newEmoji, 'EMOJI_UPDATE');
	database.UpdateEmojiName(newEmoji.id, newEmoji.name, oldEmoji.name, executor);
});

/** Returns NULL if there is not log OR the log doesn't match. If there is a match the executor id is returned */
async function EmojiLogs(Emoji: GuildEmoji, type: 'EMOJI_CREATE' | 'EMOJI_DELETE' | 'EMOJI_UPDATE') {
	const FetchedLogs = await Emoji.guild.fetchAuditLogs({
		limit: 1,
		type: type
	})

	const deletionLog = FetchedLogs.entries.first();

	if (!deletionLog) {
		return null
	}
	// The audit log is for the same emoji
	if ((deletionLog.target as GuildEmoji).id === Emoji.id) {
		return deletionLog.executor.id
	} else {
		return null
	}
}

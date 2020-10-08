import { client, database } from "..";


// emojiCreate
/* Emitted whenever a custom emoji is created in a guild.
PARAMETER    TYPE          DESCRIPTION
emoji        Emoji         The emoji that was created    */
client.on("emojiCreate", (emoji) => {
		// TODO: Executor
	database.AddEmoji(emoji);
});

// emojiDelete
/* Emitted whenever a custom guild emoji is deleted.
PARAMETER    TYPE         DESCRIPTION
emoji        Emoji        The emoji that was deleted    */
client.on("emojiDelete", (emoji) => {
	// TODO: Executor
	database.RemoveEmoji(emoji.id)
});

// emojiUpdate
/* Emitted whenever a custom guild emoji is updated.
PARAMETER    TYPE       DESCRIPTION
oldEmoji     Emoji      The old emoji
newEmoji     Emoji      The new emoji    */
client.on("emojiUpdate", (oldEmoji, newEmoji) => {
	// TODO: Executor
	// They only thing that can be changed in emojis is the name(?)
	database.UpdateEmojiName(newEmoji.id, newEmoji.name);
});

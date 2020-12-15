import { GuildMember, PartialGuildMember, User } from "discord.js";
import { client, database, GetFetchLogsSingle } from "..";
import { LogTypes } from "../DB/DB";


/* Emitted whenever a guild member changes - i.e. new role, removed role, nickname.
PARAMETER    TYPE               DESCRIPTION
oldMember    GuildMember        The member before the update
newMember    GuildMember        The member after the update    */
client.on("guildMemberUpdate", async (oldMember, newMember) => {
	// TODO: executor
	// TODO: Logs
	const deletionLog = await GetFetchLogsSingle(newMember, 'MEMBER_UPDATE');
	
	if (!deletionLog) {
		// no logs
		HandleGuildMemberUpdate(oldMember, newMember, deletionLog);
	} else {
		if ((deletionLog.target as User).id === newMember.id) {
			// target is the same as updated member
			HandleGuildMemberUpdate(oldMember, newMember, deletionLog.executor)
		} else {
			// target doesn't match
			HandleGuildMemberUpdate(oldMember, newMember)
		}
	}


});

function HandleGuildMemberUpdate(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember | PartialGuildMember, executor: User | null = null) {
	if (oldMember instanceof GuildMember && newMember instanceof GuildMember) {
		if (oldMember.nickname !== newMember.nickname) {
			// Nickname was changed
			database.ChangeNickname(newMember, executor?.id);
		}
		else if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
			// Role was changed 
			if (oldMember.roles.cache.size > newMember.roles.cache.size) {
				// Role was removed
				let RemovedRole: string;
				for (const key of oldMember.roles.cache) {
					if (!oldMember.roles.cache.has(key[0])) {
						RemovedRole = key[0];
						database.RemoveGuildMemberRole(newMember.id, RemovedRole, executor?.id)
						break;
					}
				}
			} else {
				// role was added
				let AddedRole: string;
				for (const key of newMember.roles.cache) {
					if (!oldMember.roles.cache.has(key[0])) {
						AddedRole = key[0];
						database.AddGuildMemberRole(newMember.id, AddedRole, executor?.id)
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
}

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
	// TODO: executor
	// TODO: Logs
	// INIT OPERATION HERE
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
	// TODO: executor
	// TODO: Logs
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
client.on("guildMemberRemove", async (member) => {
	console.log(`a member leaves a guild, or is kicked: ${member.id} => ${member.displayName}`);
	// TODO: Create dedicated function to delete only 1 user?
	// TODO: ADD LOGS
	const deletionLog = await GetFetchLogsSingle(member, 'MEMBER_KICK');
	const a = new Set(member.id);

	if (!deletionLog) {
		database.RemoveGuildMembersFromGuild(a);
	} else {
		const { executor, target } = deletionLog;

		if ((target as GuildMember).id === member.id) {
			// Log matches the created channel
			database.RemoveGuildMembersFromGuild(a, executor.id);
		} else {
			database.RemoveGuildMembersFromGuild(a);
		}
	}
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
	// TODO: executor
	// TODO: Logs
	console.error(`a guild is updated`);
	if (oldGuild.name !== newGuild.name) {
		// guild name was changed
		database.UpdateGuildName(newGuild.id, newGuild.name);
	}
});

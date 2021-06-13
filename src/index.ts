import { token } from "./Config";
import { Channel, Client, TextChannel, Role, VoiceChannel, CategoryChannel, NewsChannel, StoreChannel, GuildMember, GuildAuditLogsAction, GuildAuditLogs, GuildChannel, Presence, Emoji, GuildEmoji } from "discord.js";
const client = new Client({ partials: ['MESSAGE'] });
import DB, { ChannelRolePermissions, LogTypes } from "./DB/DB";
const database: DB = new DB();

import { PerformanceObserver, performance } from 'perf_hooks';
import { obs } from "../timer"

import './Bot/Channels';
import './Bot/Emojis'
import './Bot/Guilds'
import './Bot/Invites'
import './Bot/Messages'
import './Bot/Roles'
import './Bot/Voice'

export { client, database };
obs;

import chalk from "chalk";
import { SendMessageToWebSocket, WebSocket } from "./WebSocketClient";
import { DiscordBotJS } from "/home/ubuntu/DiscordBotJS/ProtoOutput/compiled";


export const ctx = new chalk.Instance({ level: 3 });
// process.on("exit", () => {
// 	console.log('Bot Terminated') 
// 	client.destroy()
// })

// process.on("SIGINT", () => {
// 	console.log('Program exited')
//	client.destroy()
// process.exit() ;
// })

const DEBUG_ENABLED = false;

// ws.on('message', function incoming(data) {
//     console.log('Bot received: %s', data);
// });

// TODO: get all guild keys not just the first
async function handleGuild(): Promise<void> {
	const guilds = client.guilds.cache
	database.Guilds = client.guilds.cache
	await database.FirstTimeInGuild(guilds);
}

async function handleChannels(): Promise<void> {
	// Check if the chanels match up since last login
	const channels = await database.GetChannels();
	const ChannelsToAdd: Array<Channel> = [];
	client.channels.cache.forEach((element, key) => {
		if (!channels.has(key)) {
			// We don't have that channel added. Add it
			ChannelsToAdd.push(element);
		}

		channels.delete(key)
	});
	if (ChannelsToAdd.length > 0) {
		await database.AddChannels(ChannelsToAdd);
		console.log(`Added new channels`)
	}
	// Channels that are present in our DB but not in the chanel
	if (channels.size > 0) {
		await database.RemoveChannels(channels)
	}

	// Update ALL channels when connecting to a server
	if (client.channels.cache.size > 0) {
		// database.UpdateAllChannels(client.channels);
	}

}

function HandleAddingPermissions<T extends GuildChannel | TextChannel | VoiceChannel | StoreChannel | CategoryChannel | NewsChannel>(element: T, a: Map<string, ChannelRolePermissions[]>) {
	if (element.permissionOverwrites.size > 0) {
		// Check if there is any permission present
		element.permissionOverwrites.forEach((permissionOverwrites, key) => {
			if (!a.has(element.id)) {
				a.set(element.id, [{
					allow_bitfield: permissionOverwrites.allow.bitfield,
					channel_id: element.id,
					type: permissionOverwrites.type,
					deny_bitfield: permissionOverwrites.deny.bitfield,
					role_id: permissionOverwrites.id
				}])
			} else {
				a.get(element.id)?.push({
					allow_bitfield: permissionOverwrites.allow.bitfield,
					channel_id: element.id,
					type: permissionOverwrites.type,
					deny_bitfield: permissionOverwrites.deny.bitfield,
					role_id: permissionOverwrites.id
				})
			}
		})
	} else {
		// No permissions. Do nothing
	}
}
function HandleUpdatingPermissions<T extends GuildChannel | TextChannel | VoiceChannel | StoreChannel | CategoryChannel | NewsChannel>
	(element: T, Roles: ChannelRolePermissions[], ToAdd: Map<string, ChannelRolePermissions[]>, ToUpdate: Map<string, ChannelRolePermissions[]>) {
	let j = 0


	element.permissionOverwrites.forEach((permissionOverwrites, key) => {
		// There might be more roles in the server than the DB
		if (Roles[j]) {
			let size = 0;
			if (Roles[j].role_id === permissionOverwrites.id) {
				// Update existing role
				// We have the permission override role in our DB
				if (permissionOverwrites.allow.bitfield === Roles[j].allow_bitfield) {
				} else {
					// Allow value changed
					if (ToUpdate.has(element.id)) {
						size = ToUpdate.set(element.id, [{
							allow_bitfield: permissionOverwrites.allow.bitfield,
							channel_id: element.id,
							type: permissionOverwrites.type,
							deny_bitfield: permissionOverwrites.deny.bitfield,
							role_id: permissionOverwrites.id,
							allow_changed: true
						}
						]).size
						// Object.assign(ToUpdate.get(element.id)![j],	{
						// 	allow_bitfield: permissionOverwrites.allow.bitfield,
						// 	channel_id: element.id,
						// 	type: permissionOverwrites.type,
						// 	deny_bitfield: permissionOverwrites.deny.bitfield,
						// 	role_id: permissionOverwrites.id,
						// 	allow_changed: true
						// })

					} else {
						size = ToUpdate.set(element.id, [{
							allow_bitfield: permissionOverwrites.allow.bitfield,
							channel_id: element.id,
							type: permissionOverwrites.type,
							deny_bitfield: permissionOverwrites.deny.bitfield,
							role_id: permissionOverwrites.id,
							allow_changed: true
						}]).size
					}

					const a = ToUpdate.get(element.id)![size - 1];
					if (a.allow_changed === true && a.deny_changed === true) {
						a.both_changed = true
					}
				}

				if (permissionOverwrites.deny.bitfield === Roles[j].deny_bitfield) {

				} else {
					// Deny value changed
					if (ToUpdate.has(element.id)) {
						size = ToUpdate.set(element.id, [{
							allow_bitfield: permissionOverwrites.allow.bitfield,
							channel_id: element.id,
							type: permissionOverwrites.type,
							deny_bitfield: permissionOverwrites.deny.bitfield,
							role_id: permissionOverwrites.id,
							deny_changed: true
						}
						]).size
						// Object.assign(ToUpdate.get(element.id)![j],	{
						// 	allow_bitfield: permissionOverwrites.allow.bitfield,
						// 	channel_id: element.id,
						// 	type: permissionOverwrites.type,
						// 	deny_bitfield: permissionOverwrites.deny.bitfield,
						// 	role_id: permissionOverwrites.id,
						// 	deny_changed: true
						// })

					} else {
						size = ToUpdate.set(element.id, [{
							allow_bitfield: permissionOverwrites.allow.bitfield,
							channel_id: element.id,
							type: permissionOverwrites.type,
							deny_bitfield: permissionOverwrites.deny.bitfield,
							role_id: permissionOverwrites.id,
							deny_changed: true
						}]).size
					}
					const a = ToUpdate.get(element.id)![size - 1];
					if (a.allow_changed === true && a.deny_changed === true) {
						a.both_changed = true
					}
				}

				delete Roles[j]

			} else {
				// Add a role that is not present in our DB
				if (ToAdd.has(element.id)) {
					ToAdd.get(element.id)![j] = {
						allow_bitfield: permissionOverwrites.allow.bitfield,
						channel_id: element.id,
						type: permissionOverwrites.type,
						deny_bitfield: permissionOverwrites.deny.bitfield,
						role_id: permissionOverwrites.id
					};
				} else {
					ToAdd.set(element.id, [{
						allow_bitfield: permissionOverwrites.allow.bitfield,
						channel_id: element.id,
						type: permissionOverwrites.type,
						deny_bitfield: permissionOverwrites.deny.bitfield,
						role_id: permissionOverwrites.id
					}])
				}
			}
		} else {
			// Add the role
			if (ToAdd.has(element.id)) {
				ToAdd.get(element.id)![j] = {
					allow_bitfield: permissionOverwrites.allow.bitfield,
					channel_id: element.id,
					type: permissionOverwrites.type,
					deny_bitfield: permissionOverwrites.deny.bitfield,
					role_id: permissionOverwrites.id
				};
			} else {
				ToAdd.set(element.id, [{
					allow_bitfield: permissionOverwrites.allow.bitfield,
					channel_id: element.id,
					type: permissionOverwrites.type,
					deny_bitfield: permissionOverwrites.deny.bitfield,
					role_id: permissionOverwrites.id
				}])
			}
		}


		j++;
	})

	return;
}

async function handleChannelRoles(): Promise<void> {
	const ChannelPermissions = await database.GetChannelPermissions();
	// 			  channel id
	let a = new Map<string, ChannelRolePermissions[]>();
	const PermissionsToAdd = new Map<string, ChannelRolePermissions[]>();
	const PermissionsToUpdate = new Map<string, ChannelRolePermissions[]>();
	const PermissionsToRemove: { channel_id: string, role_id: string, deny: number, allow: number }[] = [];

	ChannelPermissions.forEach((element) => {
		if (!a.has(element.channel_id)) {
			a.set(element.channel_id, [element])
		} else {
			a.get(element.channel_id)?.push(element)
		}
	})

	client.guilds.cache.forEach((guilds, keyGuild) => {
		guilds.channels.cache.forEach((channels, keyChannel) => {
				let RoleArr = a.get(channels.id)!
				if (RoleArr === undefined) {
					// Some channels MAY NOT have permission overrides
					// We don't have associated that channel with ANY roles
					// If the channel doesn't have permission overrides we assume its (0,0) for @everyone
					HandleAddingPermissions(channels, PermissionsToAdd);
				} else {
					// We have a channel with AT LEAST 1 role
					HandleUpdatingPermissions(channels, RoleArr, PermissionsToAdd, PermissionsToUpdate);
				
					// Go through all elements and check what's left
					// The remaining elements need to be deleted from the DB
					RoleArr.forEach((element, key) => {
						if (element) {
							PermissionsToRemove.push({ channel_id: element.channel_id, role_id: element.role_id, deny: element.deny_bitfield, allow: element.allow_bitfield });
						}
					})
				}
		})
	})

	if (PermissionsToRemove.length > 0) {
		await database.RemovePermissionFromChannel(PermissionsToRemove);
	}
	if (PermissionsToUpdate.size > 0) {
		await database.UpdateChannelPermissions1(PermissionsToUpdate);
	}
	if (PermissionsToAdd.size > 0) {
		await database.AddChannelPermissions(PermissionsToAdd);
	}

}

async function handleUsers(): Promise<void> {
	const GuildMembers = await database.GetGuildUsers();
	const UsersToAdd: GuildMember[] = [];
	client.guilds.cache.forEach((guild, keyGuild) => {
		guild.members.cache.forEach((member, keyMember) => {
			if (!GuildMembers.get(keyGuild)?.has(keyMember)) {
				// We don't have that user. Add it
				UsersToAdd.push(member);
			}
			GuildMembers.get(keyGuild)?.delete(keyMember)
		})
	})

	// loop over and check if the sets are empty
	GuildMembers.forEach((element, key) => {
		if (element.size === 0) {
			GuildMembers.delete(key)
		}
	});


	if (UsersToAdd.length > 0) {
		await database.AddUsers(UsersToAdd);
		// await database.AddGuildMembers(UsersToAdd);
	}
	// Remove any user that we itterate over.
	// Any User that's left is NOT present in the guild and has to be removed from the DB.
	if (GuildMembers.size > 0) {
		await database.RemoveGuildMembersFromGuild(GuildMembers)
	}
 
	// if (client.users.cache.size > 0) {

	// }

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
		}
		else {
			// We HAVE that role in our db
		}

		Roles.delete(key)
	});
	// Remove any role that we itterate over.
	// Any role that's left is NOT present in the guild and has to be removed from the DB.
	if (Roles.size > 0) {
		database.RemoveRoles(Roles)
	}
	// Add ALL the roles in the current guild.
	if (RolesToAdd.length > 0) {
		await database.AddRoles(RolesToAdd);
	}
	database.UpdateAllRoles(client.guilds.cache.first()?.members.cache!);
}

async function handleEmojis() {
	const emojis = await database.GetEmojis(); 

	const emojisToAdd: Array<GuildEmoji> = [];

	client.guilds.cache.forEach((guild, keyGuild) => {
		guild.emojis.cache.forEach((emoji, keyEmoji) => {
			if (!emojis.get(keyGuild)?.has(keyEmoji)) {
				// We DON'T have that emoji in our db
				emojisToAdd.push(emoji);
			} else {
	
			}
	
			emojis.get(keyGuild)?.delete(keyEmoji)
		})
	})


	if (emojis.size > 0) { 
		database.RemoveEmojis(emojis) 
	}
	// Add ALL the roles in the current guild.
	if (emojisToAdd.length > 0) {
		await database.AddEmojis(emojisToAdd);
	}
	database.UpdateAllRoles(client.guilds.cache.first()?.members.cache!);
		
}

client.on("ready", async () => {

	const me = client.guilds.cache.get('362257054829641758')
	performance.mark("a");
	// register guild
	await handleGuild();
	// Check all users. Remove, Add, Update
	await handleUsers();
	// Remove, Add, Update
	await handleRoles();
	// Remove, Add, Update
	await handleChannels();
	// Remove, Add, Update
	await handleChannelRoles();
	// await database.dummy(client.channels.cache.first()!);
	await handleEmojis();
	performance.mark("b");
	performance.measure("Init Operations done", "a", "b");

	// await database.dummy(client.channels.cache.first()!)
	database.AddLog(`Logged in as ${client.user!.tag}!`, LogTypes.general_log);

});

// channelPinsUpdate
/* Emitted whenever the pins of a channel are updated. Due to the nature of the WebSocket event, not much information can be provided easily here - you need to manually check the pins yourself.
PARAMETER    TYPE         DESCRIPTION
channel      Channel      The channel that the pins update occurred in
time         Date         The time of the pins update    */
// Seems pretty useless .on("messageUpdate") provides much more info
// client.on("channelPinsUpdate", (channel, time) => {
// 	console.log(`channelPinsUpdate: ${channel}:${time}`);
// });

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

/* Emitted whenever the client's WebSocket encounters a connection error.
PARAMETER    TYPE     DESCRIPTION
error        Error    The encountered error    */
client.on("error", (error) => {
	console.error(`client's WebSocket encountered a connection error: ${error}`);
});

// presenceUpdate
/* Emitted whenever a guild member's presence changes, or they change one of their details.
PARAMETER    TYPE               DESCRIPTION
oldMember    GuildMember        The member before the presence update
newMember    GuildMember        The member after the presence update    */
client.on("presenceUpdate", (oldMember, newMember) => {
	// console.log(newMember)
	const BotPressence = DiscordBotJS.BotResponse.create({
		id: newMember.userID,
		guild_id: newMember.guild?.id,
		botPressenceMessage: {
			status: newMember.status
		}
	})
	SendMessageToWebSocket(DiscordBotJS.BotResponse.encode(BotPressence).finish())
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

// warn
/* Emitted for general warnings. 
PARAMETER    TYPE       DESCRIPTION
info         string     The warning   */
client.on("warn", (info) => {
	console.log(`warn: ${info}`);
});

client.on("rateLimit", (a) => {
	console.log('RATE LIMIT', a);
})

client.login(token);

export async function GetFetchLogsSingle<T>(anything: T, type: GuildAuditLogsAction) {
	const fetchedLogs = await (anything as any).guild.fetchAuditLogs({
		limit: 1,
		type: type,
	}) as GuildAuditLogs;

	const deletionLog = fetchedLogs.entries.first();

	if (!deletionLog)
		return null;

	return deletionLog
}
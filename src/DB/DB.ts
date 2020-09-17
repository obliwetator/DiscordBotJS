import { Pool, createPool, createConnection, Connection } from "mysql";
import { host, password, username } from "../Config";
import {
	CategoryChannel,
	Channel,
	ChannelManager,
	Collection,
	Guild,
	Message,
	TextChannel,
	VoiceChannel,
	GuildMember,
	PartialMessage,
	Role, DMChannel, StoreChannel, NewsChannel
} from "discord.js";
import { EnumVoiceState } from "../HandleVoiceState";

import { PrismaClient } from "@prisma/client"
import { performance, PerformanceObserver } from 'perf_hooks';

import { obs } from "../../timer"
import chalk from "chalk";
import { ctx } from "..";

export const DEBUG_LOG_ENABLED = {
	AddLogs: true,
	VoiceState: false,
	AddMessage: false,
	AddMessageDM: false,
	AddChannel: false,
	AddUser: false,
	UpdateUser: false,
	UpdateNickname: true,
	AddRolesToUser: false,
	AddGuildMember: false,
	RoleDeletedFromGuild: false,
	RoleAddedToGuild: false,
	DeleteMessage: false,
	DeleteMessageBulk: false,
	DeleteMessageExecutor: false,
	DeleteMessageBulkExecutor: false,
	RoleRemovedFromMember: false,
	RoleAddedToMember: false,
	ChannelUpdate: {
		position: false
	}
}

class DB {

	/**
	 * Remove a single role for a single user
	 */
	public RemoveGuildMemberRole(id: string, RemovedRole: string): void {
		if (DEBUG_LOG_ENABLED.RoleRemovedFromMember) {
			console.log(`Role id: ${RemovedRole} has been Removed from user id: ${id}`)
		}

		const RemoveRoles = `DELETE FROM guild_users_to_roles WHERE user_id = '${id}' AND role_id = '${RemovedRole}'`;

		this.GetQuery(RemoveRoles);
	}
	/**
	 * Add a single role for a single user
	 */
	public AddGuildMemberRole(id: string, AddedRole: string): void {
		if (DEBUG_LOG_ENABLED.RoleAddedToMember) {
			console.log(`Role id: ${AddedRole} has been Added to user id: ${id}`)
		}

		const AddRole = `INSERT INTO guild_users_to_roles (user_id, role_id) VALUES ('${id}', '${AddedRole}')`;

		this.GetQuery(AddRole);
	}
	public pool: Pool;
	private prisma: PrismaClient
	GuildId: string;
	constructor() {
		this.pool = createPool({
			connectionLimit: 10,
			host,
			user: username,
			password,
			database: "DiscordBot",
			multipleStatements: true,
			charset: "utf8mb4_general_ci",
			debug: false,
		});
		this.GuildId = "";
		this.prisma = new PrismaClient()
	}

	// private SetQuery<T>(query: string, values: T) {
	// 	return new Promise((resolve, reject) => {
	// 		this.pool.query(query);
	// 	});
	// }
	private async GetQuery(query: string): Promise<[]> {
		return new Promise((resolve, reject) => {
			this.pool.query(query, (error, results) => {
				if (error) {
					reject(error);
				}
				resolve(results);
			});
		});
	}

	private async GetQueryArg(query: string, arg: Array<unknown>): Promise<[]> {
		return new Promise((resolve, reject) => {
			this.pool.query(query,arg, (error, results) => {
				if (error) {
					return reject(error);
				}
				return resolve(results);
			});
		});
	}

	public async dummy(arg0:Channel) {

		const ammount = 10_000
		performance.mark("a")
		for (let index = 0; index < ammount; index++) {	
			await this.GetQuery(`SELECT id FROM channels`);
		}
		performance.mark("b")
		performance.measure("a -> b", "a", "b")


		performance.mark("c")
		for (let index = 0; index < ammount; index++) {	
			await this.prisma.channels.findMany({select:{id:true}})
		}
		performance.mark("d")
		performance.measure("c -> d" ,"c", "d")

	}

	/**
	* The channel is marked as deleted but will stay in the DB to link to any messages in that channel 
	* as well which guild it belonged to originally
	*/
	public async RemoveChannels(channels: Set<string>) {
		// TODO: try to fetch some messages from discord as there may be gaps in our DB
		let messagesCount:number
		channels.forEach(async (channel) => {
			messagesCount = await this.prisma.channel_messages.count({
				where: {
					channel_id: channel
				}
			})
			if (messagesCount === 0) {
				// There are no messages in the channel. We can completly delete it
				// FIX: prisma2 doesn't support CASCADE deletes if the FK is non-nullable
				await this.prisma.$executeRaw(`DELETE FROM channels WHERE id = '${channel}'`)
			} else {
				// Channel has messages. Mark as deleted
				await this.prisma.channels.update({
					where: {
						id: channel
					}, 
					data: {
						is_deleted: true,
						position: -1
					}
				})
			}
		})
	}

	/**
	* The channel is marked as deleted but will stay in the DB to link to any messages in that channel 
	* as well which guild it belonged to originally
	*/
	public async RemoveChannel(channel: Channel) {
		// TODO: try to fetch some messages from discord as there may be gaps in our DB
		const count = await this.prisma.channel_messages.count({
			where: {
				channel_id: channel.id
			}
		})
		// TODO: Handle logging the deletion
		if (count === 0) {
			// There are no messages in the channel. We can completly delete it
			// FIX: prisma2 doesn't support CASCADE deletes if the FK is non-nullable
			await this.prisma.$executeRaw(`DELETE FROM channels WHERE id = '${channel}'`)
			
		} else {
			// > 0. mark the channel as deleted
			await this.prisma.channels.update({
				where: {
					id: channel.id
				}, 
				data: {
					is_deleted: true,
					position: -1
				}
			})
		}
	}

	public async AddLog(value: string, type: LogTypes, severity: SeverityEnum = SeverityEnum.default) {
		if (DEBUG_LOG_ENABLED.AddLogs) {
			if (severity === SeverityEnum.default) {
				console.log(ctx .blue(`${value}`));
			} else if (severity === SeverityEnum.info) {
				console.log(ctx.green(`${value}`));
			} else if (severity === SeverityEnum.warn) {
				console.log(ctx.keyword('orange')(`${value}`));
			} else if (severity === SeverityEnum.error) {
				console.log(ctx.red(`${value}`));
			}

		}
		this.GetQuery(`INSERT INTO log (message, category) VALUES ('${value}', '${type}')`);
	}

	public async AddMessage(message: Message) {
		if (DEBUG_LOG_ENABLED.AddMessage) {
			console.log(`message content. id: ${message.id} -> ${message.content}`)
		}
		let hasEmbed = false;
		let hasAttachment = false;
		let EmbededQuery = "";
		let AttachmentQuery = "";
		if (message.embeds.length > 0) {
			hasEmbed = true;
			EmbededQuery += `INSERT INTO embedded_messages (id,title, type, description, url, fields, footer, thumbnail, video, image, author, color)\
VALUES ('${message.id}','${message.embeds[0].title}', '${message.embeds[0].type}', '${message.embeds[0].description}', '${message.embeds[0].url}', '${message.embeds[0].fields}', '${message.embeds[0].footer}', '${message.embeds[0].thumbnail}', '${message.embeds[0].video}', '${message.embeds[0].image}', '${message.embeds[0].author}', '${message.embeds[0].color}');`;
		}
		if (message.attachments.size > 0) {
			hasAttachment = true;
			AttachmentQuery += `INSERT INTO attachment_messages (id, attachment, name, size, url)VALUES ('${message.attachments.first()?.id}', '${message.attachments.first()?.attachment}', '${message.attachments.first()?.name}', '${message.attachments.first()?.size}', '${message.attachments.first()?.url}');`;
		}
		await this.GetQuery(
			`${EmbededQuery}${AttachmentQuery}\
INSERT IGNORE INTO users (id, username, discriminator, bot)\
VALUES ('${message.author.id}', '${message.author.username}', '${message.author.discriminator}', ${message.author.bot ? 1 : 0});\
INSERT INTO channel_messages (id, content, author, type, embeds, attachments, channel_id)\
VALUES ('${message.id}', ${this.pool.escape(message.content,)}, '${message.author.id}', '${message.type}', ${hasEmbed ? `${message.id}` : "NULL"}, ${hasAttachment ? `${message.attachments.first()?.id}` : "NULL"}, '${message.channel.id}');`)
;
	}
	/**
	 * Every DM is unique between the bot and the recepient.\
	 * As such we have no guarantee that we have it in out DB\
	 * We have to check every time if the DM channel is in out DB
	 */
	public async AddMessageDM(message: Message) {
		if (DEBUG_LOG_ENABLED.AddMessageDM) {
			console.log(`message DM. id: ${message.id} -> ${message.content}`)
		}

		await this.AddMessage(message);
	}

	public async AddChannels(channels: Array<Channel>) {
		if (DEBUG_LOG_ENABLED.AddChannel) {
			channels.forEach((value) => {
				console.log(`Channel id: ${value.id} added`)
			})
		}
		//                                     NULL       NULL        NULL
		let query = "INSERT INTO channels (id, recepient, name, type, position) VALUES";
		let query2 = "INSERT INTO guild_to_channel (guild_id, channel_id) VALUES";
		const query2size = query2.length;

		channels.forEach((element) => {
			if (element instanceof TextChannel) {
				query += `('${element.id}', NULL, '${element.name}', '${element.type}', '${element.position}'),`;
				query2 += `('${this.GuildId}', '${element.id}'),`;
			}
			else if (element instanceof VoiceChannel) {
				query += `('${element.id}', NULL, '${element.name}', '${element.type}', '${element.position}'),`;
				query2 += `('${this.GuildId}', '${element.id}'),`;
			}
			else if (element instanceof CategoryChannel) {
				query += `('${element.id}', NULL, '${element.name}', '${element.type}', '${element.position}'),`;
				query2 += `('${this.GuildId}', '${element.id}'),`;
			} 
			else if (element instanceof DMChannel) {
				query += `('${element.id}', '${element.recipient.id}', NULL, '${element.type}', NULL),`;
			}
			else if (element instanceof StoreChannel) {
				query += `('${element.id}', NULL, '${element.name}', '${element.type}', '${element.position}'),`;
				query2 += `('${this.GuildId}', '${element.id}'),`;
			}
			else if (element instanceof NewsChannel) {
				query += `('${element.id}', NULL, '${element.name}', '${element.type}', '${element.position}'),`;
				query2 += `('${this.GuildId}', '${element.id}'),`;
			} else {
				// Either GroupDM channel or unkown
				console.log(chalk.red(''))
				this.AddLog(`Unimplemeneted type type of type ${element.type}`, LogTypes.general_log);
			}
		});
		// query was did not change
		if (query2size === query2.length) {
			query2 = "";
		} else {
			query2 = `${query2.slice(0, -1)};`;
		}
		// replace last , with ;
		query = `${query.slice(0, -1)};`;


		await this.GetQuery(`${query} ${query2}`);

	}
	/**
	 * Add ALL the roles in a guild
	 */
	public async AddRoles(roles: Array<Role>) {
		if (DEBUG_LOG_ENABLED.AddRolesToUser) {
			roles.forEach((value) => {
				console.log(`Role id: ${value.id} added`);
			})
		}
		let InsertRoles = "INSERT INTO roles (role_id, name, hoist, rawPossition, managed, mentionable, permissions) VALUES";
		let InsertRoleToGuild = "INSERT INTO roles_to_guild (role_id, guild_id) VALUES";

		roles.forEach((element) => {
			InsertRoles += `('${element.id}', '${element.name}', '${element.hoist ? 1 : 0}', '${element.rawPosition}', '${element.managed ? 1 : 0}', '${element.mentionable ? 1 : 0}', '${element.permissions.bitfield}'),`;

			InsertRoleToGuild += `('${element.id}', '${this.GuildId}'),`;
		})

		InsertRoles = `${InsertRoles.slice(0, -1)};`;
		InsertRoleToGuild = `${InsertRoleToGuild.slice(0, -1)};`;

		this.GetQuery(`${InsertRoles} ${InsertRoleToGuild}`);
	}

	/**
	 * Meant to run on ready
	 * Updates any member roles
	 */
	public async UpdateAllRoles(cache: Collection<string, GuildMember>) {
		const UserToRoleMap = new Map<string, Set<string>>();
		const UserRolesToAdd = new Map<string, Set<string>>();
		const GetUserToRoles = "SELECT * FROM guild_users_to_roles";

		const UserToRoles = (await this.GetQuery(
			`${GetUserToRoles}`
		) as Array<UserToRoleInterface>)

		UserToRoles.forEach((element) => {
			if (!UserToRoleMap.has(element.user_id)) {
				// Create new Set and 
				UserToRoleMap.set(element.user_id, new Set([element.role_id]));
			}
			else {
				UserToRoleMap.get(element.user_id)?.add(element.role_id);
			}
		})

		// Check If the roles in server match up with db
		cache.forEach(element => {
			element.roles.cache.forEach((Role) => {
				if (!UserToRoleMap.get(element.id)?.has(Role.id)) {
					// We don't have that role for that user
					if (UserRolesToAdd.has(element.id)) {
						// We have a map for that user
						UserRolesToAdd.get(element.id)?.add(Role.id);
					} else {
						// we don't have map. Create a new one
						UserRolesToAdd.set(element.id, new Set([Role.id]));
					}
					// We don't have ANY roles for that user
				}
				else if (UserToRoleMap.get(element.id)?.has(Role.id)) {
					// We have that role for that user

					// Remove that role from the map
					// ANy leftover role(s) are present in the DB but NOT in the server and have to be removed
					UserToRoleMap.get(element.id)?.delete(Role.id)
				}
			})
			if (UserToRoleMap.get(element.id)?.size === 0) {
				// IF the user has no roles to be removed, remove them from the map
				UserToRoleMap.delete(element.id);
			}
		});
		// Add the roles to the db
		if (UserRolesToAdd.size > 0) {
			this.AddRolesToUsers(UserRolesToAdd)
		}
		// Remove the roles from db
		if (UserToRoleMap.size > 0) {
			this.RemoveRolesFromUsers(UserToRoleMap)
		}
	}
	/**
	 * Remove Roles AND everything they are linked to
	 * FK removal is done on the DB itself
	 */
	RemoveRoles(Roles: Set<string>) {
		if (DEBUG_LOG_ENABLED.RoleDeletedFromGuild) {
			Roles.forEach((key) => {
				console.log(`Role id: ${key} has is not present in the guild anymore`)
			})
		}
		//let DeleteRolesToGuildMember = `DELETE FROM guild_users_to_roles WHERE role_id IN (`
		//let DeleteRolesToGuild = `DELETE FROM roles_to_guild WHERE role_id IN (`;
		let DeleteRole = `DELETE FROM roles WHERE role_id IN (`;

		Roles.forEach((element) => {
			//DeleteRolesToGuildMember += element + ",";
			//DeleteRolesToGuild += element + ",";
			DeleteRole += element + ",";
		});

		//DeleteRolesToGuildMember = DeleteRolesToGuildMember.slice(0, -1) + ");";
		//DeleteRolesToGuild = DeleteRolesToGuild.slice(0, -1) + ");";
		DeleteRole = DeleteRole.slice(0, -1) + ");";

		this.GetQuery(`${DeleteRole}`)
	}

	/**
	 * Meant to run on ready
	 * Add all roles that are out of sync
	 */
	public async AddRolesToUsers(UserRolesToAdd: Map<string, Set<string>>) {
		if (DEBUG_LOG_ENABLED.AddRolesToUser) {
			UserRolesToAdd.forEach((element, key) => {
				console.log(`Added roles for user ${key} => `)
				element.forEach((value) => {
					console.log(`Role id: ${value}`)
				})
				
			})
		}
		let AddUsersRoles = "INSERT INTO guild_users_to_roles (user_id, role_id) VALUES"

		UserRolesToAdd.forEach((UserId, key) => {
			UserId.forEach((RoleId) => {
				AddUsersRoles += `('${key}', '${RoleId}'),`
			})
		})

		AddUsersRoles = `${AddUsersRoles.slice(0, -1)};`;

		this.GetQuery(AddUsersRoles);
	}

	/**
	 * Meant to run on ready
	 * Removes all roles that are out of sync
	 */
	public async RemoveRolesFromUsers(RolesToRemove: Map<string, Set<string>>) {
		let DeleteUserRole = "DELETE FROM guild_users_to_roles WHERE user_id IN(";
		let query2 = "";

		RolesToRemove.forEach((UserId, key) => {
			UserId.forEach(RoleId => {
				DeleteUserRole += key + ",";
				query2 += RoleId + ",";
			});
		});
		query2 = query2.slice(0, -1) + ")";
		DeleteUserRole = DeleteUserRole.slice(0, -1) + ")";
		DeleteUserRole += "AND role_id IN (" + query2;

		this.GetQuery(DeleteUserRole);
	}

	/**
	 * Get ALL channels in the guild
	 */
	public async GetChannels(GuildId: string): Promise<Set<string>> {
		if (GuildId === undefined) {
			this.AddLog("guildId was undefined", LogTypes.general_log);
		}

		const ChannelMap = new Set<string>();

		const Channels = (await this.GetQuery(
			`SELECT guild_to_channel.channel_id 
			FROM guild_to_channel 
			WHERE guild_to_channel.guild_id = '${GuildId}'
			`,
		) as Array<GuildToChannelsInterface>);

		Channels.forEach((element) => {
			ChannelMap.add(element.channel_id);
		});
		return ChannelMap;
	}
	/**
	 * Get ALL users in the guild
	 */
	public async GetGuildUsers(): Promise<Set<string>> {
		const GuildUsersSet = new Set<string>();

		const GuildUsers = (await this.GetQuery(`
			SELECT user_id FROM user_to_guild WHERE guild_id = '${this.GuildId}'
		`) as Array<UsersInterface>)

		GuildUsers.forEach((element) => {
			GuildUsersSet.add(element.user_id);
		})

		return GuildUsersSet;
	}

	/**
	 * Get ALL roles in the guild
	 */
	public async GetRoles(): Promise<Set<string>> {
		const RolesSet = new Set<string>();

		const Roles = (await this.GetQuery(`
			SELECT role_id FROM roles_to_guild WHERE guild_id = '${this.GuildId}'
		`) as Array<RolesInterface>);

		Roles.forEach((element) => {
			RolesSet.add(element.role_id)
		})

		return RolesSet;
	}
	/**
	 * Add an existing user as a guild user
	 */
	AddGuildMembers(member: Array<GuildMember>) {
		if (DEBUG_LOG_ENABLED.AddGuildMember) {
			member.forEach((element) => {
				console.log(`Guild Member id: ${element.id} added`)
			})
		}
		// Add GuildMembers
		let InsertGuildUser = "INSERT INTO guild_user (user_id, nickname) VALUES";
		let InsertGuildUserRoles = "INSERT INTO guild_users_to_roles (user_id, role_id) VALUES";

		member.forEach((element) => {
			InsertGuildUser += `('${element.id}', '${element.nickname ? element.nickname : element.user.username}'),`;
			element.roles.cache.forEach(role => {
				InsertGuildUserRoles += `('${element.id}', '${role.id}'),`
			});
		})

		InsertGuildUser = `${InsertGuildUser.slice(0, -1)};`;
		InsertGuildUserRoles = `${InsertGuildUserRoles.slice(0, -1)};`;

		this.GetQuery(`${InsertGuildUser} ${InsertGuildUserRoles}`);
	}

	// User refers to the the the discord account. It has no assosiation with the guilds(servers) the user is in.
	// We can only interact with the GuildUser that is in our guild
	public async AddUsers(Users: Array<GuildMember>) {
		if (DEBUG_LOG_ENABLED.AddUser) {
			Users.forEach((value) => {
				console.log(`User id: ${value.id} added`)
			})
		}

		// Inserts the user. This the global user and not a GuildMember
		let InsertUsers = "INSERT IGNORE INTO users (id, username, discriminator, bot) VALUES";
		// Link the user to a guild
		let InsertUsersToGuild = "INSERT INTO user_to_guild (user_id, guild_id) VALUES";

		Users.forEach((element) => {
			InsertUsers += `('${element.id}', '${element.user.username}', '${element.user.discriminator}', ${element.user.bot ? 1 : 0}),`
			InsertUsersToGuild += `('${element.id}', '${this.GuildId}'),`
		})
		// , -> ;
		InsertUsers = `${InsertUsers.slice(0, -1)};`;
		InsertUsersToGuild = `${InsertUsersToGuild.slice(0, -1)};`;

		this.GetQuery(`${InsertUsers} ${InsertUsersToGuild}`);
	}

	// GuildMember is removed from a guild. That member will be removed from that guild
	// BUT the User will stay in the databse as he may be in other guild
	public async RemoveGuildMembersFromGuild(GuildMember: Set<string>) {
		let RemoveUsersFromGuild = `
		DELETE FROM user_to_guild WHERE user_to_guild.guild_id = ${this.GuildId}`;
		GuildMember.forEach((element) => {
			RemoveUsersFromGuild += `AND user_to_guild.user_id = ${element}`;
		})

		RemoveUsersFromGuild += ";";

		this.GetQuery(RemoveUsersFromGuild);
	}

	public async FirstTimeInGuild(GuildId: string): Promise<boolean> {
		const guild = await this.GetQuery(
			`SELECT * FROM guilds WHERE id = "${GuildId}"`,
		);

		if (guild.length > 0) {
			return false;
		} else {
			return true;
		}
	}
	public AddGuild(Guild: Guild, Channels: Collection<string, TextChannel>) {
		// create the query for all the channels
		let InsertChannels = "INSERT INTO channels (id, name, type, position) VALUES";
		let InsertChannelsToGuild = "INSERT INTO guild_to_channel (guild_id, channel_id) VALUES";
		Channels.forEach((element) => {
			InsertChannels += `('${element.id}', '${element.name}', '${element.type}', '${element.position}'),`;
			InsertChannelsToGuild += `('${Guild.id}', '${element.id}'),`;
		});
		// replace last , with ;
		InsertChannels = `${InsertChannels.slice(0, -1)};`;
		InsertChannelsToGuild = `${InsertChannelsToGuild.slice(0, -1)};`;

		this.GetQuery(
			`
				INSERT INTO guilds (id, name , owner_id) VALUES ('${Guild.id}', '${Guild.name}', '${Guild.ownerID}');
				${InsertChannels}
				${InsertChannelsToGuild}
			`,
		);
	}
	public async UpdateAllChannels(Channels: ChannelManager) {
		const query = "UPDATE `channels` SET `name`=?,`type`=?,`position`=? WHERE `channels`.`id` = ?;";
		let args: Array<string | number> = [];
		Channels.cache.forEach((element) => {
			// A Channel can be any of the 3 subcategories
			if (element instanceof TextChannel) {
				args.push(element.name, element.type, element.position);
			} else if (element instanceof VoiceChannel) {
				args.push(element.name, element.type, element.position);
			} else if (element instanceof CategoryChannel) {
				args.push(element.name, element.type, element.position);
			} else if(element instanceof DMChannel) {
				// args.push(element.name, element.type, element.position);
			} else {
				this.AddLog(`Unimplemeneted type of type ${element.type}, ${element.id}`, LogTypes.channel);
			}
			args.push(element.id);
			this.GetQueryArg(query, args);
			args = [];
		});

	}

	/**  
	 *Partial messages only guarantees the id\
	 *When deleting messages we only care about the deleted message and we don't need the rest of information
	*/
	public async DeleteMessage(msg: PartialMessage) {
		if (DEBUG_LOG_ENABLED.DeleteMessage) {
			console.log("Message Deleted =>" , msg);
		}
		const UpdateDeleteMessageQuery = `UPDATE channel_messages SET is_deleted=1 WHERE id = '${msg.id}';`;
		const DeleteMessageQuery = `INSERT INTO channel_messages_deleted (message_id, deleted_at) VALUES ('${msg.id}', '${Date.now()}');`

		this.GetQuery(UpdateDeleteMessageQuery + DeleteMessageQuery);
	}
	/**  
	 * Same as base function but we know who deleted the message
	*/
	public async DeleteMessageExecutor(msg: PartialMessage, executor = "", timestamp: number): Promise<void> {
		if (DEBUG_LOG_ENABLED.DeleteMessageExecutor) {
			console.log(`Message Deleted, Executor: ${executor} =>`, msg);
		}

		const DeleteMessageQuery = `UPDATE channel_messages SET is_deleted=1 WHERE id = '${msg.id}';`;
		const AddExecutor = `INSERT INTO channel_messages_deleted (message_id, executor, deleted_at) VALUES ('${msg.id}', '${executor}', '${timestamp}');`

		this.GetQuery(`${DeleteMessageQuery} ${AddExecutor}`);
	}
	/** 
	*Partial messages only guarantees the id\
	*When deleting messages we only care about the deleted message and we don't need the rest of information
	*/
	public async DeleteMessages(msgs: Collection<string, PartialMessage>) {
		if (DEBUG_LOG_ENABLED.DeleteMessageBulk) {
			msgs.forEach((element) => {
				console.log("Message Deleted =>" , element);
			})
		}
		let DeleteMessagesQuery = "UPDATE channel_messages SET is_deleted=1 WHERE id IN (";
		let DeleteMessageQuery = `INSERT INTO channel_messages_deleted (message_id, deleted_at) VALUES `;
		const CurrentTimestamp = Date.now();

		msgs.forEach((_value, key) => {
			DeleteMessagesQuery += key + ',';
			DeleteMessageQuery += `('${key}' , '${CurrentTimestamp}'),`
		})
		DeleteMessagesQuery = DeleteMessagesQuery.slice(0, -1) + ");";
		DeleteMessageQuery = DeleteMessageQuery.slice(0, -1) + ";";

		this.GetQuery(DeleteMessagesQuery + DeleteMessageQuery);
	}

	public async DeleteMessagesExecutor(msgs: Collection<string, PartialMessage>, executor: string, timestamp: number) {
		if (DEBUG_LOG_ENABLED.DeleteMessageBulkExecutor) {
			msgs.forEach((element) => {
				console.log(`Message Deleted, Executor: ${executor} =>`, element);
			})
		}

		let DeleteMessagesQuery = "UPDATE channel_messages SET is_deleted=1 WHERE id IN (";
		let AddExecutor = `INSERT INTO channel_messages_deleted (message_id, executor, deleted_at) VALUES`
		msgs.forEach((_value, key) => {
			DeleteMessagesQuery += key + ','
			AddExecutor += `(${key}, ${executor}, ${timestamp}),`
		})

		DeleteMessagesQuery = DeleteMessagesQuery.slice(0, -1) + ");";
		AddExecutor = AddExecutor.slice(0, -1) + ";";

		this.GetQuery(DeleteMessagesQuery + AddExecutor);
	}

	public async AddVoiceState(VoiceState: EnumVoiceState, UserId: string, ChannelId: string, Executor = "") {
		if (DEBUG_LOG_ENABLED.VoiceState) {
			console.log(`State: ${EnumVoiceState[VoiceState]}, User: ${UserId}, Channel: ${ChannelId}`)
		}

		const VoiceStateQuery = `INSERT INTO voice_states (user_id, channel_id, category, executor) VALUES ('${UserId}', '${ChannelId}', '${VoiceState}', ${Executor.length > 0 ? `${Executor}` : "NULL"});`

		this.GetQuery(VoiceStateQuery);
	}

	public async GetDeletionLogByTimestamp(ts: number): Promise<channel_messages_deleted[]> {
		const GetDeletionLogByTimestamp = `SELECT * FROM channel_messages_deleted WHERE deleted_at = "${ts}";`

		return this.GetQuery(GetDeletionLogByTimestamp);
	}

	ChangeNickname(newMember: GuildMember) {
		if (DEBUG_LOG_ENABLED.UpdateNickname) {
			if (newMember.nickname === null) {
				console.log(`User id: ${newMember.id} Changed his nickname to ${newMember.user.username}`);
			} else {
				console.log(`User id: ${newMember.id} Changed his nickname to ${newMember.nickname}`);
			}
		}

		let UpdateGuildmemberNickname = ""

		// If the NEW nickname is null that mean sthe user reset theit nickname to the default value
		// The default value is the discord username
		if (newMember.nickname === null) {
			UpdateGuildmemberNickname = `UPDATE guild_user SET nickname = '${newMember.user.username}' WHERE user_id = '${newMember.id}';`;
		} else {
			UpdateGuildmemberNickname = `UPDATE guild_user SET nickname = '${newMember.nickname}' WHERE user_id = '${newMember.id}';`;
		}

		this.GetQuery(UpdateGuildmemberNickname);
	}

	public async UpdateChannelPosition(channelId: string, newPos: number) {
		if (DEBUG_LOG_ENABLED.ChannelUpdate.position) {
			console.log(`New Channel Position => ${newPos} for channel: ${channelId}`)
			
		}

		await this.prisma.channels.update({
			where:{
				id: channelId
			},
			data:{
				position: newPos
			}
		})
	}

	public GetDMChannel(channel: DMChannel): Promise<ChannelsInterface[]> {
		const GetDMChannelQuery = `SELECT id FROM channels WHERE id = ${channel.id}`

		const a = this.GetQuery(GetDMChannelQuery)

		return a
	}
}	



export default DB;

interface channel_messages_deleted {
	message_id: string,
	executor: string,
	deleted_at: number
}

interface GuildToChannelsInterface {
	channel_id: string
}

interface ChannelsInterface {
	id: string
}

interface UsersInterface {
	user_id: string
}

interface RolesInterface {
	role_id: string
}

interface UserToRoleInterface {
	user_id: string,
	role_id: string,
}

export enum LogTypes {
	general_log,
	guild,
	channel,
	user,
	guild_member,
}

export enum SeverityEnum {
	default,
	info,
	warn,
	error

}
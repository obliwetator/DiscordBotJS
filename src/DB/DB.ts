import { Pool, createPool } from "mysql";
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
	Role,
} from "discord.js";
import { EnumVoiceState } from "../HandleVoiceState";

import { performance } from 'perf_hooks';

export const DEBUG_LOG_ENABLED = {
	VoiceState: false,
	AddMessage: false,
	AddChannel: false,
	AddUser: false,
	UpdateUser: false,
	AddRoles: false,
	AddGuildMember: false,
	RoleDeletedFromGuild: false,
	RoleAddedToGuild: true,
}

class DB {
	RemoveGuildMemberRole(id: string, AddedRole: string) {
		throw new Error("Method not implemented.");
	}
	AddGuildMemberRole(id: string, RemovedRole: string) {
		throw new Error("Method not implemented.");
	}
	UpdateUser(arg0: GuildMember) {
		// throw new Error("Method not implemented.");
	}
	public pool: Pool;
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
	}

	// private SetQuery<T>(query: string, values: T) {
	// 	return new Promise((resolve, reject) => {
	// 		this.pool.query(query);
	// 	});
	// }
	private GetQuery(query: string): Promise<[]> {
		return new Promise((resolve, reject) => {
			this.pool.query(
				query,
				(error, results) => {
					if (error) {
						return reject(error);
					}
					return resolve(results);
				},
			);
		});
	}

	private GetQueryArg(query: string, arg: Array<unknown>): Promise<[]> {
		return new Promise((resolve, reject) => {
			this.pool.query(
				query,
				arg,
				(error, results) => {
					if (error) {
						return reject(error);
					}
					return resolve(results);
				},
			);
		});
	}

	public RemoveTable(name: TextChannel) {
		const sql = `UPDATE channels SET is_deleted = '1' WHERE channels.id = '${name.id}';`;
		this.GetQuery(sql);
	}

	public async AddLog(value: string, type: LogTypes) {
		console.log(value);
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
INSERT INTO channel_messages (id, content, author, type, embeds, attachments, channel_id)
VALUES ('${message.id}', ${this.pool.escape(message.content,)}, '${message.author.id}', '${message.type}', ${hasEmbed ? `${message.id}` : "NULL"}, ${hasAttachment ? `${message.attachments.first()?.id}` : "NULL"}, '${message.channel.id}');`);

	}

	public async AddChannels(channels: Array<Channel>) {
		if (DEBUG_LOG_ENABLED.AddChannel) {
			channels.forEach((value) => {
				console.log(`Channel id: ${value.id} added`)
			})
		}
		let query = "INSERT INTO channels (id, name, type, position) VALUES";
		let query2 = "INSERT INTO guild_to_channel (guild_id, channel_id) VALUES";
		channels.forEach((element) => {
			if (element instanceof TextChannel) {
				query += `('${element.id}', '${element.name}', '${element.type}', '${element.position}'),`;
			}
			else if (element instanceof VoiceChannel) {
				query += `('${element.id}', '${element.name}', '${element.type}', '${element.position}'),`;
			}
			else if (element instanceof CategoryChannel) {
				query += `('${element.id}', '${element.name}', '${element.type}', '${element.position}'),`;
			} else {
				this.AddLog(`Unimplemeneted type type of type ${element.type}`, LogTypes.general_log);
			}
			query2 += `('${this.GuildId}', '${element.id}'),`;
		});
		// replace last , with ;
		query = `${query.slice(0, -1)};`;
		query2 = `${query2.slice(0, -1)};`;

		this.GetQuery(`${query} ${query2}`);
	}
	/**
	 * Add ALL the roles in a guild
	 */
	public async AddRoles(roles: Array<Role>) {
		if (DEBUG_LOG_ENABLED.AddRoles) {
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
		let UserToRoleMap = new Map<string, Set<string>>();
		let UserRolesToAdd = new Map<string, Set<string>>();
		let GetUserToRoles = "SELECT * FROM guild_users_to_roles";

		const UserToRoles = (await this.GetQuery(
			`${GetUserToRoles}`
		) as Array<UserToRoleInterface>)

		const t0 = performance.now();

		UserToRoles.forEach((element) => {
			if (!UserToRoleMap.has(element.user_id)) {
				// Create new Set and 
				UserToRoleMap.set(element.user_id, new Set([element.role_id]));
			}
			else {
				UserToRoleMap.get(element.user_id)?.add(element.role_id);
			}
		})

		// Check If the roles min server match up with db
		cache.forEach(element => {
			element.roles.cache.forEach((Role) => {
				if (!UserToRoleMap.get(element.id)?.has(Role.id)) {
					// We don't have ANY roles for that user
					console.log('User doesn\'t have that role');
				}
				else {
					// We have some role(s) for that user
					console.log('User has that role');
				}
			})

		});
		const t1 = performance.now();
		console.log(`Call to doSomething took ${t1 - t0} milliseconds.`);
		console.log(UserToRoleMap)
	}
	/**
	 * Remove Roles AND everything they are linked to
	 * FK removal is done on the DB itself
	 */
	RemoveRoles(Roles: Set<string>) {
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
		) as Array<ChannelsInterface>);


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
			InsertGuildUser += `('${element.id}', '${element.nickname ? element.nickname : "NULL"}'),`;
			element.roles.cache.forEach(role => {
				InsertGuildUserRoles += `('${element.id}', '${role.id}'),`
			});
		})

		InsertGuildUser = `${InsertGuildUser.slice(0, -1)};`;
		InsertGuildUserRoles = `${InsertGuildUserRoles.slice(0, -1)};`;

		this.GetQuery(`${InsertGuildUser} ${InsertGuildUserRoles}`)
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

	// User is removed from a guild. That user will be removed from that guild
	// BUT he will stay in the databse as he may be in other guild
	public async RemoveUsersFromGuild(Users: Set<string>) {
		let RemoveUsersFromGuild = `
		DELETE FROM user_to_guild WHERE user_to_guild.guild_id = ${this.GuildId}`;
		Users.forEach((element) => {
			RemoveUsersFromGuild += `AND user_to_guild.user_id = ${element}`;
		})

		RemoveUsersFromGuild += ";";

		this.GetQuery(RemoveUsersFromGuild)
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
			}
			else if (element instanceof VoiceChannel) {
				args.push(element.name, element.type, element.position);
			}
			else if (element instanceof CategoryChannel) {
				args.push(element.name, element.type, element.position);
			}
			else {
				this.AddLog(`Unimplemeneted type of type ${element.type}`, LogTypes.channel);
			}
			args.push(element.id);
			this.GetQueryArg(query, args);
			args = [];
		});
	}

	/**  
	Partial messages only guarantees the id\
	When deleting messages we only care about the deleted message and we don't need the rest of information
	*/
	public async DeleteMessage(msg: PartialMessage) {
		// throw new Error("Method not implemented.");
		const DeleteMessageQuery = `UPDATE channel_messages SET is_deleted=1 WHERE id = '${msg.id}'`;

		this.GetQuery(DeleteMessageQuery);
	}
	/** 
	Partial messages only guarantees the id\
	When deleting messages we only care about the deleted message and we don't need the rest of information
	*/
	public async DeleteMessages(msgs: Collection<string, PartialMessage>) {
		let DeleteMessagesQuery = "UPDATE channel_messages SET is_deleted=1 WHERE id IN (";
		msgs.forEach((_value, key) => {
			DeleteMessagesQuery += key + ','
		})
		DeleteMessagesQuery = DeleteMessagesQuery.slice(0, -1) + ");";
		this.GetQuery(DeleteMessagesQuery);
	}

	public async AddVoiceState(VoiceState: EnumVoiceState, UserId: string, ChannelId: string, Executor: string = "") {
		if (DEBUG_LOG_ENABLED.VoiceState) {
			console.log(`State: ${EnumVoiceState[VoiceState]}, User: ${UserId}, Channel: ${ChannelId}`)
		}

		const VoiceStateQuery = `INSERT INTO voice_states (user_id, channel_id, category, executor) VALUES ('${UserId}', '${ChannelId}', '${VoiceState}', ${Executor.length > 0 ? `${Executor}` : "NULL"});`

		this.GetQuery(VoiceStateQuery);
	}
}


export default DB;

interface ChannelsInterface {
	channel_id: string
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
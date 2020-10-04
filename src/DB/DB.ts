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
	Role, DMChannel, StoreChannel, NewsChannel, Invite, PermissionOverwrites
} from "discord.js";
import { EnumVoiceState } from "../HandleVoiceState";

import { PrismaClient } from "@prisma/client"
import { performance, PerformanceObserver } from 'perf_hooks';

import { obs } from "../../timer"
import chalk from "chalk";
import { ctx } from "..";

obs;

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
	UpdateGuildName: false,
	ChannelUpdate: {
		position: false,
		name: false,
		nsfw: false,
		rateLimit: false,
		topic: false,
		permissions: false
	}
}

class DB {
	public async UpdateMessage(DBMessage: ChannelMessage, newMessage: Message) {
		// Id, Author, ChannelId and is_deleted CANNOT be changed
		let UpdateMessage = `UPDATE channel_messages SET content = '${newMessage.content}', is_pinned = ${newMessage.pinned ? 1 : 0}, is_edited = 1 WHERE id = '${newMessage.id}';`
		let UpdateMessageLog = `INSERT INTO log__channel_messages (message_id, og_message) VALUES ('${newMessage.id}', '${DBMessage.content}');`

		await this.GetQuery(UpdateMessage + UpdateMessageLog)
	}
	// TODO: Rename

	public async GetMessage(id: string): Promise<ChannelMessage[]> {
		const sql = `SELECT * FROM channel_messages WHERE id = '${id}'`

		return await this.GetQuery(sql);
	}
	public async UpdateChannelPins(msg: Message) {
		const sql = `UPDATE channel_messages SET is_pinned = 1 WHERE id = '${msg.id}';`

		await this.GetQuery(sql);
	}
	// TODO: Add executor
	public async UpdateChannelPermissions1(PermissionsToUpdate: Map<string, ChannelRolePermissions[]>) {
		let query = "INSERT INTO channel_permissions (channel_id, role_id, type, allow_bitfield, deny_bitfield) VALUES"
		let dup = "ON DUPLICATE KEY UPDATE allow_bitfield = VALUES(allow_bitfield) , deny_bitfield = VALUES(deny_bitfield)"
		let UpdateLog = "INSERT INTO log__channel_permissions (role_id, channel_id, type, og_allow, og_deny) VALUES"
		let type = ""
		PermissionsToUpdate.forEach((permissions) => {
			permissions.forEach((element) => {
				if (element.both_changed) {
					type = "update_both"
				} else {
					if (element.allow_changed) {
						type = "update_allow"
					} else {
						type = "update_deny"
					}
				}
				query += `('${element.channel_id}', '${element.role_id}', '${element.type}', ${element.allow_bitfield}, ${element.deny_bitfield}),`
				UpdateLog += `('${element.role_id}', '${element.channel_id}', '${type}', ${(type === "update_both" || type === "update_allow") ? element.allow_bitfield : "NULL"}, ${(type === "update_both" || type === "update_deny") ? element.deny_bitfield : "NULL"})`
			})
		})

		query = `${query.slice(0, -1)} `;
		let a = query + dup + ";" + UpdateLog;
		await this.GetQuery(query + dup);
	}
	// TODO: Add executor
	public async AddChannelPermissions(PermissionsToAddUpdate: Map<string, ChannelRolePermissions[]>) {
		let query = "INSERT INTO channel_permissions (channel_id, role_id, type, allow_bitfield, deny_bitfield) VALUES"
		let dup = "ON DUPLICATE KEY UPDATE allow_bitfield = VALUES(allow_bitfield) , deny_bitfield = VALUES(deny_bitfield)"

		PermissionsToAddUpdate.forEach((permissions) => {
			permissions.forEach((element) => {
				query += `('${element.channel_id}', '${element.role_id}', '${element.type}', '${element.allow_bitfield}', '${element.deny_bitfield}'),`
			})
		})

		query = `${query.slice(0, -1)} `;
		this.GetQuery(query + dup);
	}
	/**
	 * Delete a channel permission and add a log
	 * When adding a long the values at the time of removal are set
	 */
	public async RemovePermissionFromChannel(PermissionsToRemove: { channel_id: string, role_id: string, deny: number, allow: number }[], executor: string | null = null) {
		let query = "DELETE FROM channel_permissions WHERE (channel_id, role_id) IN ("
		let LogQuery = `INSERT INTO log__channel_permissions (role_id, channel_id, executor, type, og_allow, og_deny) VALUES `
		PermissionsToRemove.forEach((element, key) => {
			query += `('${element.channel_id}', '${element.role_id}'),`
			LogQuery += `('${element.role_id}', '${element.channel_id}', ${executor ? `'${executor}'` : "NULL"}, 'remove', ${element.allow}, ${element.deny}),`
		})

		query = `${query.slice(0, -1)});`;
		LogQuery = `${LogQuery.slice(0, -1)};`;

		await this.GetQuery(query + LogQuery);
	}
	public async GetChannelPermissions() {
		// Very inneficient query
		// const a = await this.prisma.channel_permissions.findMany({
		// 	include:{
		// 		channels:{
		// 			include:{
		// 				guild_to_channel:{
		// 					where:{
		// 						guild_id: this.GuildId
		// 					}
		// 				}
		// 			}
		// 		}
		// 	}
		// })

		const a = await this.GetQuery(`SELECT channel_permissions.* FROM channel_permissions LEFT JOIN channels ON channel_permissions.channel_id = channels.channel_id LEFT JOIN guild_to_channel ON guild_to_channel.channel_id = channels.channel_id WHERE guild_to_channel.guild_id = '${this.GuildId}'`) as ChannelRolePermissions[]

		return a;
	}
	public async AddDMChannel(channel: DMChannel) {
		await this.prisma.channels.create({
			data: {
				channel_id: channel.id,
				types: "dm",
				channel__dm: {
					create: {
						recepient: channel.recipient.id
					}
				}
			}
		})
	}
	public async UpdateTextChannelNsfw(channelId: string, nsfw: boolean) {
		if (DEBUG_LOG_ENABLED.ChannelUpdate.nsfw) {
			console.log(`Channel id: ${channelId} has set nsfw to ${nsfw}`)
		}

		await this.prisma.channel__text.update({ where: { channel_id: channelId }, data: { nsfw: nsfw } })
	}
	public async UpdateTextChannelRateLimit(channelId: string, rateLimitPerUser: number) {
		if (DEBUG_LOG_ENABLED.ChannelUpdate.rateLimit) {
			console.log(`Channel id: ${channelId} has set ratelimit to ${rateLimitPerUser}`)
		}

		await this.prisma.channel__text.update({ where: { channel_id: channelId }, data: { rate_limit_per_user: rateLimitPerUser } })
	}
	public async UpdateTextChannelTopic(channelId: string, topic: string | null) {
		if (DEBUG_LOG_ENABLED.ChannelUpdate.topic) {
			console.log(`Channel id: ${channelId} has set topic to ${topic}`)
		}

		await this.prisma.channel__text.update({ where: { channel_id: channelId }, data: { topic: topic } })
	}

	/**
	 * og_deny and _allow log the values BEFORE the change. Current values will be in the channel_permissions
	 * Except when deleting, which will list both values
	 */
	public async UpdateChannelPermissions(channelId: string, permissionOverwritesOld: Collection<string, PermissionOverwrites>, permissionOverwritesNew: Collection<string, PermissionOverwrites>) {
		if (DEBUG_LOG_ENABLED.ChannelUpdate.permissions) {
			permissionOverwritesNew.forEach((element, key) => {
				console.log(`Permission updated for channel id: ${channelId} for the permission: ${key}`)
			})
		}
		let AllowDiff: boolean
		let DenyDiff: boolean
		let type: "add" | "remove" | "update_deny" | "update_allow" | "update_both"
		let UpdateAllowIndex = 1 // Defaults to NULL
		let UpdateDenyIndex = 1

		// TODO: Add executor
		let executor:string; //temp

		let Update: [number, string][] = [[0, "NULL"], [0, "NULL"]];


		if (permissionOverwritesOld.size > permissionOverwritesNew.size) {
			// Role was removed from channel 
			permissionOverwritesOld.forEach(async (element, key) => {
				if (permissionOverwritesNew.has(key)) {
					// Permissions match do nothing
				} else {
					// prisma2 bugs out when deleting a entry with 2 unique collumns
					await this.RemovePermissionFromChannel([{ channel_id: channelId, role_id: key, allow: element.allow.bitfield, deny: element.deny.bitfield }])
					return;
				}
			})
		} else if (permissionOverwritesOld.size < permissionOverwritesNew.size) {
			// Role was added
			permissionOverwritesNew.forEach(async (element, key) => {
				AllowDiff = false
				DenyDiff = false

				if (!permissionOverwritesOld.has(key)) {
					// permissions don't match add that permission
					await this.prisma.channel_permissions.create({
						data: {
							channels: { connect: { channel_id: channelId } },
							allow_bitfield: element.allow.bitfield,
							deny_bitfield: element.deny.bitfield,
							role_id: key,
							type: element.type
						}
					})

					this.GetQuery(`INSERT INTO log__channel_permissions (role_id, channel_id, executor, type, og_allow, og_deny) VALUES ('${element.id}', '${channelId}', ${executor ? `'${executor}'` : "NULL"}, 'add', NULL, NULL)`)
					return;
				}

			})
		} else {
			// a permission for a role was updated
			// LOG: update_both, update_deny,update_allow
			permissionOverwritesOld.forEach(async (OldElement, key) => {
				// Allow diff
				if (OldElement.allow.bitfield !== permissionOverwritesNew.get(key)?.allow.bitfield) {
					AllowDiff = true;
				}
				// Deny diff
				if (OldElement.deny.bitfield !== permissionOverwritesNew.get(key)?.deny.bitfield) {
					DenyDiff = true;
				}
				// Both changed
				if (AllowDiff && DenyDiff) {
					type = "update_both"
					Update[0][0] = OldElement.allow.bitfield;
					Update[1][0] = OldElement.deny.bitfield;
					UpdateAllowIndex = 0
					UpdateDenyIndex = 0
				} else {
					if (AllowDiff) {
						// allow changed
						type = "update_allow"
						Update[0][0] = OldElement.allow.bitfield;
						UpdateAllowIndex = 0
					} else {
						// deny chanegd
						type = "update_deny"
						Update[1][0] = OldElement.deny.bitfield;
						UpdateDenyIndex = 0
					}
				}

				const NewUpdate = permissionOverwritesNew.get(key)!
				
				let AddLog = `INSERT INTO log__channel_permissions (role_id, channel_id, executor, type, og_allow, og_deny) VALUES ('${OldElement.id}', '${channelId}', NULL, '${type}', ${Update[0][UpdateAllowIndex]}, ${Update[1][UpdateDenyIndex]});`
				let a = `UPDATE channel_permissions SET allow_bitfield = ${OldElement.allow.bitfield !== NewUpdate.allow.bitfield ? NewUpdate.allow.bitfield : "allow_bitfield"}, deny_bitfield = ${OldElement.deny.bitfield !== NewUpdate.deny.bitfield ? NewUpdate.deny.bitfield : "deny_bitfield"} WHERE channel_id = '${channelId}' AND role_id = '${OldElement.id}'`
				 await this.GetQuery(a + ";" + AddLog)
			});
		}

		return;
	}
	public async UpdateGuildName(id: string, name: string) {
		if (DEBUG_LOG_ENABLED.UpdateGuildName) {
			console.log(`Guild id: ${id} Changed treir name to ${name}`)
		}
		await this.prisma.guilds.update({
			where: {
				id: id
			},
			data: {
				name: name
			}
		})
	}
	// invite_id: invite.code,
	// channel_id: invite.channel.id,
	// created_at: invite.createdTimestamp!,
	// inviter_id: invite.inviter?.id,
	// max_age: invite.maxAge,
	// max_uses: invite.maxUses,
	// uses: invite.uses,
	// temporary: invite.temporary,
	// deleted: false
	public async AddInvite(invite: Invite) {
		await this.prisma.channel_invites.create({
			data: {
				invite_id: invite.code,
				channels: { connect: { channel_id: invite.channel.id } },
				created_at: invite.createdTimestamp!,
				guild_user: { connect: { user_id: invite.inviter?.id } },
				max_age: invite.maxAge,
				max_uses: invite.maxUses,
				uses: invite.uses,
				temporary: invite.temporary,
				deleted: false
			}
		})
	}
	/** 
	 * Mark the invite as deleted
	*/
	public async RemoveInvite(invite: Invite) {
		await this.prisma.channel_invites.update({
			where: {
				invite_id: invite.code
			},
			data: {
				deleted: true
			}
		})
	}

	public async ExpireInvite(invite: Invite) {
		await this.prisma.channel_invites.update({
			where: {
				invite_id: invite.code
			},
			data: {
				expired: true
			}
		})
	}

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
			connectionLimit: 100,
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
			this.pool.query(query, arg, (error, results) => {
				if (error) {
					return reject(error);
				}
				return resolve(results);
			});
		});
	}

	public async dummy(arg0: Channel) {


		const a = await this.GetQuery(`CALL find_channel(${arg0.id})`);

		const ammount = 10_0000
		performance.mark("a")
		for (let index = 0; index < ammount; index++) {
			//this.GetQuery(`SELECT * FROM channels`);
		}
		performance.mark("b")
		performance.measure("RAW SQL", "a", "b")


		performance.mark("c")
		for (let index = 0; index < ammount; index++) {
			//this.prisma.channels.findMany()
		}
		performance.mark("d")
		performance.measure("prisma", "c", "d")

		performance.mark("e")
		for (let index = 0; index < ammount; index++) {
			// this.prisma.$executeRaw(`SELECT * FROM channels`)
		}
		performance.mark("f")
		performance.measure("prisma RAW", "e", "f")

		performance.mark("g")
		for (let index = 0; index < ammount; index++) {
			// 25 times slower than manual joins
			// await this.prisma.channel_permissions.findMany({
			// 	include: {
			// 		channels: {
			// 			include: {
			// 				guild_to_channel: {
			// 					where: {
			// 						guild_id: this.GuildId
			// 					}
			// 				}
			// 			}
			// 		}
			// 	}
			// })
		}
		performance.mark("h")
		performance.measure("Prisma 2 joins", "g", "h")

		performance.mark("k")
		for (let index = 0; index < ammount; index++) {
			// await this.GetQuery(`SELECT channel_permissions.* FROM channel_permissions LEFT JOIN channels ON channel_permissions.channel_id = channels.channel_id LEFT JOIN guild_to_channel ON guild_to_channel.channel_id = channels.channel_id WHERE guild_to_channel.guild_id = '${this.GuildId}'`) as ChannelRolePermissions[]
			performance.mark("j")
		}
		performance.measure("RAW 2 joins", "k", "j")


	}

	/**
	* The channel is marked as deleted but will stay in the DB to link to any messages in that channel 
	* as well which guild it belonged to originally
	*/
	public async RemoveChannels(channels: Set<string>) {
		// TODO: try to fetch some messages from discord as there may be gaps in our DB
		let messagesCount: number
		channels.forEach(async (channel) => {
			messagesCount = await this.prisma.channel_messages.count({
				where: {
					channel_id: channel
				}
			})
			if (messagesCount === 0) {
				// There are no messages in the channel. We can completly delete it
				// FIX: prisma2 doesn't support CASCADE deletes if the FK is non-nullable
				await this.prisma.$executeRaw(`DELETE FROM channels WHERE channel_id = '${channel}'`)
			} else {
				// Channel has messages. Mark as deleted
				await this.prisma.channels.update({
					where: {
						"channel_id": channel,
					},
					data: {
						is_deleted: true
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
			await this.prisma.$executeRaw(`DELETE FROM channels WHERE channel_id = '${channel}'`)

		} else {
			// > 0. mark the channel as deleted
			await this.prisma.channels.update({
				where: {
					channel_id: channel.id
				},
				data: {
					is_deleted: true,
					//position: -1
				}
			})
		}
	}

	public async AddLog(value: string, type: LogTypes, severity: SeverityEnum = SeverityEnum.default) {
		if (DEBUG_LOG_ENABLED.AddLogs) {
			if (severity === SeverityEnum.default) {
				console.log(ctx.blue(`${value}`));
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
INSERT INTO channel_messages (id, content, author, type, embeds, attachments, channel_id, is_pinned)\
VALUES ('${message.id}', ${this.pool.escape(message.content,)}, '${message.author.id}', '${message.type}', ${hasEmbed ? `${message.id}` : "NULL"}, ${hasAttachment ? `${message.attachments.first()?.id}` : "NULL"}, '${message.channel.id}', ${message.pinned ? 1 : 0});`);
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

		let ChannelQuery = "INSERT INTO channels (channel_id, types) VALUES"
		let GuildToChannelQuery = "INSERT INTO guild_to_channel (guild_id, channel_id) VALUES";
		let ChannelPermissionsQuery = "INSERT INTO channel_permissions (channel_id, role_id, type, allow_bitfield, deny_bitfield) VALUES"
		let InsertChannelQuery = "";

		channels.forEach((element) => {
			// add the channel
			ChannelQuery += `('${element.id}', '${element.type}'),`

			if (element instanceof TextChannel) {
				element.permissionOverwrites.forEach((permission) => {
					ChannelPermissionsQuery += `('${element.id}', '${permission.id}', '${permission.type}', '${permission.allow.bitfield}', '${permission.deny.bitfield}'),`
				})

				GuildToChannelQuery += `('${this.GuildId}', '${element.id}'),`;
				InsertChannelQuery += `INSERT INTO channel__text (channel_id, name, position, topic, nsfw, rate_limit_per_user) VALUES ('${element.id}', '${element.name}', '${element.position}', '${element.topic}', '${element.nsfw ? 1 : 0}', '${element.rateLimitPerUser}');`

			}
			else if (element instanceof VoiceChannel) {
				element.permissionOverwrites.forEach((permission) => {
					ChannelPermissionsQuery += `('${element.id}', '${permission.id}', '${permission.type}', '${permission.allow.bitfield}', '${permission.deny.bitfield}'),`
				})

				GuildToChannelQuery += `('${this.GuildId}', '${element.id}'),`;
				InsertChannelQuery += `INSERT INTO channel__voice (channel_id, name, position) VALUES ('${element.id}', '${element.name}', '${element.position}');`
			}
			else if (element instanceof CategoryChannel) {
				element.permissionOverwrites.forEach((permission) => {
					ChannelPermissionsQuery += `('${element.id}', '${permission.id}', '${permission.type}', '${permission.allow.bitfield}', '${permission.deny.bitfield}'),`
				})

				GuildToChannelQuery += `('${this.GuildId}', '${element.id}'),`;
				InsertChannelQuery += `INSERT INTO channel__category (channel_id, position, name) VALUES ('${element.id}', '${element.position}', '${element.name}');`
			}
			else if (element instanceof DMChannel) {
				return;
			}
			else if (element instanceof StoreChannel) {
				element.permissionOverwrites.forEach((permission) => {
					ChannelPermissionsQuery += `('${element.id}', '${permission.id}', '${permission.type}', '${permission.allow.bitfield}', '${permission.deny.bitfield}'),`
				})

				GuildToChannelQuery += `('${this.GuildId}', '${element.id}'),`;
				InsertChannelQuery += `INSERT INTO channel__store (channel_id, name, position) VALUES ('${element.id}', '${element.name}', '${element.position}');`
			}
			else if (element instanceof NewsChannel) {
				element.permissionOverwrites.forEach((permission) => {
					ChannelPermissionsQuery += `('${element.id}', '${permission.id}', '${permission.type}', '${permission.allow.bitfield}', '${permission.deny.bitfield}'),`
				})

				GuildToChannelQuery += `('${this.GuildId}', '${element.id}'),`;
				InsertChannelQuery += `INSERT INTO channel__news (channel_id, name, position) VALUES ('${element.id}', '${element.name}', '${element.position}');`
			} else {
				// Either GroupDM channel or unkown
				console.log(chalk.red(''))
				this.AddLog(`Unimplemeneted type type of type ${element.type}`, LogTypes.general_log);
			}
		});
		// query was did not change

		ChannelQuery = `${ChannelQuery.slice(0, -1)};`;
		ChannelPermissionsQuery = `${ChannelPermissionsQuery.slice(0, -1)};`;
		GuildToChannelQuery = `${GuildToChannelQuery.slice(0, -1)};`;

		if (InsertChannelQuery.length === 0) {
			// DM Channel
			return;
		}
		await this.GetQuery(ChannelQuery);
		await this.GetQuery(ChannelPermissionsQuery)
		await this.GetQuery(GuildToChannelQuery)
		await this.GetQuery(InsertChannelQuery)

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
		// Get all non deleted channels
		const Channels = (await this.GetQuery(
			`SELECT channels.channel_id FROM channels LEFT JOIN guild_to_channel ON guild_to_channel.channel_id = channels.channel_id
			WHERE guild_to_channel.guild_id = '${GuildId}' AND is_deleted = 0`,
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
	public async AddGuildMembers(member: Array<GuildMember>) {
		if (DEBUG_LOG_ENABLED.AddGuildMember) {
			member.forEach((element) => {
				console.log(`Guild Member id: ${element.id} added`)
			})
		}
		// Add GuildMembers
		let InsertGuildUser = "INSERT INTO guild_user (user_id, nickname) VALUES";
		member.forEach((element) => {
			InsertGuildUser += `('${element.id}', '${element.nickname ? element.nickname : element.user.username}'),`;

		})

		InsertGuildUser = `${InsertGuildUser.slice(0, -1)};`;

		await this.GetQuery(InsertGuildUser);
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

		await this.GetQuery(`${InsertUsers} ${InsertUsersToGuild}`);
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
	public AddGuild(Guild: Guild) {
		this.GetQuery(`INSERT INTO guilds (id, name , owner_id) VALUES ('${Guild.id}', '${Guild.name}', '${Guild.ownerID}');`);
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
			} else if (element instanceof DMChannel) {
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
			console.log("Message Deleted =>", msg);
		}
		// Updates exisiting message or adds a new entry with the three properties provided
		// ID          CHANNEL_ID         TYPE
		const DeleteProcedure = `CALL delete_message('${msg.id}', '${msg.channel.id}', 'UNKOWN')`;

		// const UpdateDeleteMessageQuery = `UPDATE channel_messages SET is_deleted=1 WHERE id = '${msg.id}';`;
		// const DeleteMessageQuery = `INSERT INTO channel_messages_deleted (message_id, deleted_at) VALUES ('${msg.id}');`

		this.GetQuery(DeleteProcedure);
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
				console.log("Message Deleted =>", element);
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

	ChangeNickname(newMember: GuildMember) {
		if (DEBUG_LOG_ENABLED.UpdateNickname) {
			if (newMember.nickname === null) {
				console.log(`User id: ${newMember.id} Changed to his default username: ${newMember.user.username}`);
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

	public async UpdateChannelPosition(channelId: string, newPos: number, type: "text" | "dm" | "voice" | "group" | "category" | "news" | "store" | "unknown") {
		if (DEBUG_LOG_ENABLED.ChannelUpdate.position) {
			console.log(`New Channel Position => ${newPos} for channel: ${channelId}`)
		}

		if (type === "text") {
			this.prisma.channel__text.update({ where: { channel_id: channelId }, data: { position: newPos } })
		} else if (type === "voice") {
			this.prisma.channel__voice.update({ where: { channel_id: channelId }, data: { position: newPos } })
		} else if (type === "category") {
			this.prisma.channel__category.update({ where: { channel_id: channelId }, data: { position: newPos } })
		} else if (type === "news") {
			this.prisma.channel__news.update({ where: { channel_id: channelId }, data: { position: newPos } })
		} else if (type === "store") {
			this.prisma.channel__store.update({ where: { channel_id: channelId }, data: { position: newPos } })
		}
	}

	public async UpdateChannelname(channelId: string, name: string, type: "text" | "dm" | "voice" | "group" | "category" | "news" | "store" | "unknown") {
		if (DEBUG_LOG_ENABLED.ChannelUpdate.name) {
			console.log(`New Channel name => ${name} for channel: ${channelId}`)
		}

		if (type === "text") {
			this.prisma.channel__text.update({ where: { channel_id: channelId }, data: { name: name } })
		} else if (type === "voice") {
			this.prisma.channel__voice.update({ where: { channel_id: channelId }, data: { name: name } })
		} else if (type === "category") {
			this.prisma.channel__category.update({ where: { channel_id: channelId }, data: { name: name } })
		} else if (type === "news") {
			this.prisma.channel__news.update({ where: { channel_id: channelId }, data: { name: name } })
		} else if (type === "store") {
			this.prisma.channel__store.update({ where: { channel_id: channelId }, data: { name: name } })
		}
	}

	public GetDMChannel(channel: DMChannel): Promise<ChannelsInterface[]> {
		const GetDMChannelQuery = `SELECT channel_id FROM channels WHERE channel_id = ${channel.id}`

		const a = this.GetQuery(GetDMChannelQuery)

		return a
	}
}



export default DB;


interface ChannelMessage {
	id: string,
	content: string,
	author: string,
	type: string,
	embeds?: string,
	attachments?: string,
	channel_id: string,
	is_pinned: boolean,
	is_deleted: boolean
}
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

export interface ChannelRolePermissions {
	channel_id: string,
	role_id: string,
	type: "member" | "role"
	allow_bitfield: number,
	deny_bitfield: number,
	allow_changed?: boolean,
	deny_changed?: boolean,
	both_changed?: boolean,
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
import {Pool, createPool} from "mysql";
import {host, password, username} from "../Config";
import {
	CategoryChannel,
	Channel,
	ChannelManager,
	Collection,
	Guild,
	Message,
	TextChannel,
	VoiceChannel,
	User,
} from "discord.js";

interface TablesInDiscordBot {
	Tables_in_DiscordBot: string;
}

class DB {
	public pool: Pool;
	private DB_NAME: string = "DiscordBot";
	private TablesList: Map<string, string> = new Map();
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
		this.GetTables();
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
		let sql = `UPDATE channels SET is_deleted = '1' WHERE channels.id = '${name.id}';`;
		this.GetQuery(sql);
	}

	private async GetTables() {
		let a = (await this.GetQuery("show tables") as Array<TablesInDiscordBot>);
		a.forEach((value) => {
			this.TablesList.set(
				value.Tables_in_DiscordBot,
				value.Tables_in_DiscordBot,
			);
		});
	}

	public GetTableList() {
		return this.TablesList;
	}

	public async AddLog(value: string) {
		console.log(value);
		this.GetQuery(`INSERT INTO log (message) VALUES ('${value}')`);
	}

	public async AddMessage(message: Message) {
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
INSERT IGNORE INTO users (id, username, guild_id, discriminator, bot)\
VALUES ('${message.author.id}', '${message.author.username}', '${message.guild?.id}',  '${message.author.discriminator}', ${message.author.bot
				? 1
				: 0});\
INSERT INTO channel_messages (id, content, author, type, embeds, attachments, channel_id, guild_id)VALUES ('${message.id}', ${this.pool.escape(
				message.content,
			)}, '${message.author.id}', '${message.type}', ${hasEmbed
				? `${message.id}`
				: "NULL"}, ${hasAttachment
				? `${message.attachments.first()?.id}`
				: "NULL"}, '${message.channel.id}', '${this.GuildId}');`,
		);
	}

	public async AddChannels(channels: Array<Channel>) {
		let query = "INSERT INTO channels (id, name, type, position) VALUES";
		let query2 = "INSERT INTO guild_to_channel (guild_id, channel_id) VALUES";
		channels.forEach((element) => {
			// "hack" to make typescript happy
			if (element.type === "text") {
				let TextChannel = (element as TextChannel);
				query += `('${TextChannel.id}', '${TextChannel.name}', '${TextChannel.type}', '${TextChannel.position}'),`;
			}
			if (element.type === "voice") {
				let VoiceChannel = (element as VoiceChannel);
				query += `('${VoiceChannel.id}', '${VoiceChannel.name}', '${VoiceChannel.type}', '${VoiceChannel.position}'),`;
			}
			if (element.type === "category") {
				let CataegoryChannel = (element as CategoryChannel);
				query += `('${CataegoryChannel.id}', '${CataegoryChannel.name}', '${CataegoryChannel.type}', '${CataegoryChannel.position}'),`;
			} else {
				this.AddLog(`Unimplemeneted type type of type ${element.type}`);
			}
			query2 += `('${this.GuildId}', '${element.id}'),`;
		});
		// replace last , with ;
		query = `${query.slice(0, -1)};`;
		query2 = `${query2.slice(0, -1)};`;

		this.GetQuery(`${query} ${query2}`);
	}

	public async GetChannels(GuildId: string): Promise<Map<string, string>> {
		if (GuildId === undefined) {
			this.AddLog("guildId was undefined");
		}

		let ChannelMap = new Map();

		let Channels = (await this.GetQuery(
			`SELECT guild_to_channel.channel_id, channels.name
                FROM guild_to_channel 
                LEFT JOIN channels ON guild_to_channel.channel_id = channels.id
                WHERE guild_to_channel.guild_id =  '${GuildId}' 
            `,
		) as Array<ChannelsInterface>);

		Channels.forEach((element) => {
			ChannelMap.set(element.channel_id, element.name);
		});
		return ChannelMap;
	}

	public async GetUsers(): Promise<Map<string, string>> {
		let UsersMap = new Map();

		let Users = (await this.GetQuery(`
			SELECT id ,username, discriminator, bot FROM users WHERE guild_id = ${this.GuildId}
		`) as Array<UsersInterface>)

		Users.forEach((element) => {
			UsersMap.set(element.id, element.username + '#' + element.discriminator);
		})

		return UsersMap;
	}

	public async AddUsers(Users: Array<User>) {
		let query = "INSERT INTO users (id, guild_id, username, discriminator, bot) VALUES";

		Users.forEach((element) => {
			query += `('${element.id}', '${this.GuildId}', '${element.username}', '${element.discriminator}', ${element.bot ? 1: 0}),`
		})

		query = `${query.slice(0, -1)};`;

		this.GetQuery(`${query}`);
	}

	public async FirstTimeInGuild(GuildId: string): Promise<boolean> {
		let guild = await this.GetQuery(
			`SELECT * FROM guilds WHERE id = "${GuildId}"`,
		);

		if (guild.length > 0) {
			return false;
		} else {
			return true;
		}
	}
	AddGuild(Guild: Guild, Channels: Collection<string, TextChannel>) {
		// create the query for all the channels
		let query = "INSERT INTO channels (id, name, type, position) VALUES";
		let query2 = "INSERT INTO guild_to_channel (guild_id, channel_id) VALUES";
		Channels.forEach((element) => {
			query += `('${element.id}', '${element.name}', '${element.type}', '${element.position}'),`;
			query2 += `('${Guild.id}', '${element.id}'),`;
		});
		// replace last , with ;
		query = `${query.slice(0, -1)};`;
		query2 = `${query2.slice(0, -1)};`;

		this.GetQuery(
			`INSERT INTO guilds (id, name, member_count, owner_id) VALUES ('${Guild.id}', '${Guild.name}', '${Guild.memberCount}', '${Guild.ownerID}');
                        ${query}
                        ${query2}
                        `,
		);
	}
	public async UpdateAllChannels(Channels: ChannelManager) {
		let query = "UPDATE `channels` SET `name`=?,`type`=?,`position`=? WHERE `channels`.`id` = ?;";
		let args: Array<string | number> = [];
		Channels.cache.forEach((element) => {
			// "hack" to make typescript happy
			if (element.type === "text") {
				let TextChannel = (element as TextChannel);
				args.push(TextChannel.name, TextChannel.type, TextChannel.position);
			} else if (element.type === "voice") {
				let VoiceChannel = (element as VoiceChannel);
				args.push(VoiceChannel.name, VoiceChannel.type, VoiceChannel.position);
			} else if (element.type === "category") {
				let CataegoryChannel = (element as CategoryChannel);
				args.push(
					CataegoryChannel.name,
					CataegoryChannel.type,
					CataegoryChannel.position,
				);
			} else {
				this.AddLog(`Unimplemeneted type of type ${element.type}`);
			}
			args.push(element.id);
			this.GetQueryArg(query, args);
			args = [];
		});
	}
}
export default DB;

interface ChannelsInterface {
	channel_id: string;
	name: string;
}

interface UsersInterface {
	id: string,
	guild_id?: string,
	username: string,
	discriminator: string,
	bot: boolean
}

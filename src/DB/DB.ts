import { createConnection, Connection, FieldInfo, createPool, Pool } from 'mysql'
import { host, username, password } from '../Config'
import { TextChannel, Message } from 'discord.js'

interface TablesInDiscordBot {
    Tables_in_DiscordBot: string
}

class DB {
    public pool: Pool
    private DB_NAME: string = "DiscordBot"
    private TablesList: Map<string,string> = new Map
    constructor() {
        this.pool = createPool({
            connectionLimit: 10,
            host: host,
            user: username,
            password: password,
            database: "DiscordBot"
        });

        this.GetTables()
    }

    private SetQuery<T>(query: string, values: T) {
        return new Promise((resolve, reject) => {
            this.pool.query(query)
        })
    }
    private GetQuery(query: string) {
        return new Promise((resolve, reject) => {
            this.pool.query(query, (error, results) => {
                if (error) return reject(error)
                return resolve(results)
            })
        })
    }

    public async CreateTable(name: TextChannel) {
        let sql = "CREATE TABLE `DiscordBot`." + '`' + name.name + "_" + name.id +'`' + " ( `ID` INT NOT NULL AUTO_INCREMENT ,\
         `message` VARCHAR(2000) NOT NULL ,\
         `time_added` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ,\
         `user_id` VARCHAR(50) NOT NULL,\
         `username` VARCHAR(50) NOT NULL,\
         `discriminator` VARCHAR(4) NOT NULL,\
         `bot` BOOLEAN NOT NULL,\
          PRIMARY KEY (`ID`)) ENGINE = InnoDB;"

          await this.GetQuery(sql)

          this.TablesList.set(name.name + "_" + name.id, name.name + "_" + name.id)
    }

    public async RemoveTable(name: TextChannel) {
        let sql = "DROP TABLE `DiscordBot`." + '`' + name.name + "_" + name.id + '`'
        await this.GetQuery(sql)
        this.TablesList.delete(name.name + "_" + name.id)
    }

    private async GetTables() {
        let a = await this.GetQuery('show tables') as TablesInDiscordBot[]
        a.forEach((value) => {
            this.TablesList.set(value.Tables_in_DiscordBot,value.Tables_in_DiscordBot)
        })
    }

    public GetTableList() {
        return this.TablesList
    }

    public async AddLog(value: string) {
        console.log(value)
        let a = await this.GetQuery(`INSERT INTO log (message) VALUES ('${value}')`)
    }

    public async AddMessage(message: Message, channel: TextChannel) {
        console.log((message.channel as TextChannel).name + ": " + message.content)
        await this.GetQuery(`INSERT INTO \`${channel.name}_${channel.id}\` (message, user_id, username, discriminator, bot)
        VALUES ('${message.content}', '${message.author.id}', '${message.author.username}', '${message.author.discriminator}', '${message.author.bot? 1: 0}')`)
    }
}

export default DB
import { token } from './Config'
import DB from './DB/DB'
import {Client, GuildChannel, TextChannel} from 'discord.js'

const database = new DB()

const client = new Client();

client.on('ready', () => {
    database.AddLog(`Logged in as ${client.user!.tag}!`)
});

client.on('channelCreate', channel => {
    if (channel.type == 'text') {
        let TextChannel = channel as TextChannel
        database.CreateTable(TextChannel)
        database.AddLog(`Text Channel Created:  ${TextChannel.name}`)
    }
})

client.on('channelDelete', channel => {
    if (channel.type == 'text') {
        let TextChannel = channel as TextChannel
        database.RemoveTable(TextChannel)
        database.AddLog(`Text Channel Deleted:  ${TextChannel.name}`)
    }
})

client.on('message', msg => {
    // Adds the database if it doesnt exist when typing into a channel
    let list = database.GetTableList()
    let counter = 0
    list.forEach(element => {
        if ((msg.channel as TextChannel).name + "_" + (msg.channel as TextChannel).id !== element) {
            counter++
        }
        if (counter == list.size) {
            console.log('counter', counter)
            console.log('size', list.size)
            database.CreateTable((msg.channel as TextChannel))
        }
    });
    if (msg.channel.type == "text") {
        // Has an attachment
        if (msg.attachments.first()) {
            // TODO: Handle attachments
            database.AddMessage(msg, msg.channel)
        }
        else {
            database.AddMessage(msg, msg.channel)
        }
    }

});

client.login(token);
import { createConnection, Connection } from 'mysql'
import { host, username, password } from '../Config'

class DB {
    public con: Connection
    private DB_NAME: string = "DiscordBot"
    private TablesList: string[] = []
    private GetTables() {
        // Get the tables in our DB
        this.con.query(`show tables`,
        (error, results, fields ) => {
            if (error) throw error
            results.forEach((element: any) => {
                this.TablesList.push(element.Tables_in_DiscordBot)
            });
        })
    }

    constructor() {
        this.con = createConnection({
            host: host,
            user: username,
            password: password,
            database: "DiscordBot"
        });
        
        this.con.connect(function (err) {
            if (err) throw err;
            console.log("Connected!");
        });

        this.GetTables()
    }
}

export default DB
import { client, ctx, database } from "..";
import { LogTypes } from "../DB/DB";

client.on("inviteCreate", (invite) => {
	console.log(ctx.red(`Invite Created:`), invite)
	if (invite.maxAge) {
		setTimeout(() => {
			database.ExpireInvite(invite);
			database.AddLog("Event Expired", LogTypes.general_log)
		}, (invite.maxAge + 1000) * 1000);
	}
	database.AddInvite(invite)
})

client.on("inviteDelete", (invite) => {
	console.log(ctx.red(`Invite Deleted`, invite))
	database.RemoveInvite(invite)
})
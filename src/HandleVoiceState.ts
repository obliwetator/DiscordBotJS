import { VoiceState } from "discord.js"

/**
 * Decides what was the action in the users voice state\
 * muted/defean... etc
 */
export function HandleVoiceState(oldState: VoiceState, newState: VoiceState) {
    if (newState.mute || newState.deaf) {
        // User was muted/deafened
        if (newState.selfMute) {
            console.log('User self-muted')	
        } else if (newState.serverMute) {
            console.log('User server-muted')
        }

        if (newState.selfDeaf) {
            console.log('User self-deafened')
        } else if (newState.serverDeaf) {
            console.log('User server-deafened')
        }

    } else if (!newState.mute || !newState.deaf) {
        // user was unmuted/undeafened
        if (!newState.selfMute && oldState.selfMute) {
            console.log('User un-self-muted')
        } else if (!newState.serverMute && oldState.serverMute) {
            console.log('User un-server-muted')
        }

        if (!newState.selfDeaf && oldState.selfDeaf) {
            console.log('User un-self-deafened')
        } else if (!newState.serverDeaf && oldState.serverDeaf) {
            console.log('User un-server-deafened')
        }
    }
}

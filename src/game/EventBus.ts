import * as Phaser from 'phaser';

/**
 * Global event bus for communication between Phaser scenes and React UI.
 *
 * Phaser scenes emit events; React components subscribe via EventBus.on() in
 * useEffect. Always remember to .off() in cleanup to avoid leaks.
 *
 * Events used in the Spike:
 *   'show-dialogue': { name: string, lines: string[] }
 */
export const EventBus = new Phaser.Events.EventEmitter();

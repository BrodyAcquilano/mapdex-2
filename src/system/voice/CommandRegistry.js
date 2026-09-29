// system/voice/CommandRegistry.js

export class CommandRegistry {
  constructor() {
    this.commands = [];
  }

  register({
    command,
    aliases = [],
    match,
    handler,
    description,
    section = "Other",
  }) {
    this.commands.push({
      command,
      aliases,
      match,
      handler,
      description: description || match.toString(),
      section,
    });
  }

  unregister(match) {
    this.commands = this.commands.filter(
      (cmd) => cmd.match.toString() !== match.toString()
    );
  }

  execute(transcript) {
    for (const command of this.commands) {
      const match = transcript.match(command.match);
      if (match) {
        command.handler(match, transcript);
        return true;
      }
    }
    return false;
  }

  getCommands() {
    return this.commands.map((cmd) => ({
      command: cmd.command,
      aliases: cmd.aliases || [],
      pattern: cmd.match.toString(),
      description: cmd.description,
      section: cmd.section || "Other",
      handler: cmd.handler,
      match: cmd.match,
    }));
  }
}
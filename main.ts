import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import { join } from "path";

interface TypingSoundsPluginSettings {
  muted: boolean;
  volume: number;
}

const SOUND_RELATIVE_PATH = "sounds";

const AUDIO_PLAYER_COUNT = 10; // To avoid choking sounds by quick typists
const AUDIO_PITCH_VARIATION = 0.025; // Very slightly change pitch of sounds

const DEFAULT_SETTINGS: TypingSoundsPluginSettings = {
  muted: false,
  volume: 1.0,
};

function getPluginFilePath(plugin: Plugin, filename: string) {
  return plugin.app.vault.adapter.getResourcePath(
    join(plugin.app.vault.configDir, "plugins", `obsidian-${plugin.manifest.id}`, filename)
  );
}

function getRandomPlaybackRate() {
  return 1.0 + AUDIO_PITCH_VARIATION * (2.0 * Math.random() - 1.0);
}

class SoundPlayer {
  available: HTMLAudioElement[];

  constructor(audioFileName: string) {
    this.available = [];
    for (let i = 0; i < AUDIO_PLAYER_COUNT; ++i) {
      const player = new Audio(audioFileName);
      // @ts-expect-error: preservesPitch is not a standard property for player
      player.preservesPitch = false;
      this.available.push(player);

      player.addEventListener("play", () => {
        this.available.remove(player);
      });

      player.addEventListener("ended", () => {
        this.available.push(player);
      });
    }
  }

  play(volume: number): void {
    const player = this.available.pop();
    if (player) {
      player.volume = volume;
      player.playbackRate = getRandomPlaybackRate();
      player.play();
    }
  }
}

export default class TypingSoundsPlugin extends Plugin {
  settings: TypingSoundsPluginSettings;
  keyPlayer: SoundPlayer;
  enterPlayer: SoundPlayer;

  async onload() {
    this.addSettingTab(new TypingSoundsSettingTab(this.app, this));
    this.keyPlayer = new SoundPlayer(getPluginFilePath(this, `${SOUND_RELATIVE_PATH}/key.wav`));
    this.enterPlayer = new SoundPlayer(getPluginFilePath(this, `${SOUND_RELATIVE_PATH}/enter.wav`));

    this.addCommand({
      id: "toggle-mute-typing-sounds",
      name: "Toggle mute typing sounds",
      callback: async () => {
        this.settings.muted = !this.settings.muted;
        await this.saveSettings();
      },
    });

    this.registerDomEvent(document, "keydown", (event: KeyboardEvent) => {
      if (this.settings.muted) {
        return;
      }
      const isSuggestionContainerVisible = document.getElementsByClassName("suggestion-container").length > 0;
      const isMarkdownEditor = this.app.workspace.activeEditor?.editor?.hasFocus() && !isSuggestionContainerVisible;
      if (isMarkdownEditor) {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
          return;
        }
        if (event.code === "Enter") {
          this.enterPlayer.play(this.settings.volume);
        } else {
          this.keyPlayer.play(this.settings.volume);
        }
      }
    });

    await this.loadSettings();
  }

  async onunload() {
    // ...
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class TypingSoundsSettingTab extends PluginSettingTab {
  plugin: TypingSoundsPlugin;

  constructor(app: App, plugin: TypingSoundsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Typing sounds muted")
      .setDesc("Mute typewriter sounds.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.muted).onChange(async (value) => {
          this.plugin.settings.muted = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Volume")
      .setDesc("Typewriter sounds volume.")
      .addSlider((slider) =>
        slider
          .setLimits(0.0, 1.0, 0.05)
          .setValue(this.plugin.settings.volume)
          .onChange(async (value) => {
            console.log("value", value);
            this.plugin.settings.volume = value;
            await this.plugin.saveSettings();
          })
      );
  }
}

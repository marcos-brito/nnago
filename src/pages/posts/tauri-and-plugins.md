---
layout: ../../layouts/Post.astro
title: "Plugin system with Tauri"
ogTitle: A quick guide on how to create a plugin system with Tauri I wish I had 48 hours ago
image: /nnago/floppy.png
imageAlt: A floppy disk
publishedDate: 04-02-2025
modifiedDate: 04-02-2025
tags: tauri plugin quickjs
description: Learn different approachs to create a plugin system with Tauri. We'll talk about CSP, QuickJS and some projects that can used as inspiration
---

# Introduction

This is a very quick guide on how to create a plugin system with Tauri. Looking at it now
is way easier than it seemed a few hours ago.

I'm going to use Tauri v2 with Svelte and assume you just created your project after reading the
[Quick Start](https://v2.tauri.app/start/create-project/). The process should be similar with other versions, frameworks and scenarios.

In short, we are going to:

- Deal with some security stuff
- Load resources (JS, CSS and images) at run time
- Create a simple API for plugins to use

> If you don't need much explanation, check the [source code](https://github.com/marcos-brito/tauri-plugin-system).

# Loading stuff

The first thing that might come to mind is just use the `script` tag and define the `src`. Let's try that.

```typescript
<script lang="ts">
    import { PUBLIC_PATH_TO_PLUGIN } from "$env/static/public";
</script>

<svelte:head>
    <script src={PUBLIC_PATH_TO_PLUGIN}></script>
</svelte:head>

```

After running this you'll get something like:

`Failed to load resource: the server responded with a status of 404 (Not Found)`
`localhost:{SOME_PORT}/{PUBLIC_PATH_TO_PLUGIN}`

> SOME_PORT and PUBLIC_PATH_TO_PLUGIN are just placeholders ok? You'll see something different on your screen.

When looking at the resource path you'll see that the URL, indeed, does not exist.
Let's try something different. It's possible to open files in the browser using `file://`, so here it goes:

```typescript
...
<svelte:head>
    <script src={`file://${PUBLIC_PATH_TO_PLUGIN}`}></script>
</svelte:head>
...
```

That gave us a different result, but it's not quite what we want:

`Not allowed to load local resource: file://{PUBLIC_PATH_TO_PLUGIN}`

Now we have two problems. Damn. But worry not, my friend, we also have two solutions:

- Actually create the resource
- Somehow allow access to resources in the file system

Let's try the first.

It's possible to create resource in the client side using `URL.createObjectURL`. For that
we first need to get the bytes from the file. Two options for this:

- [Tauris's file system plugin](https://v2.tauri.app/plugin/file-system/)
- [Rust command](https://v2.tauri.app/develop/calling-rust/#commands)

The second is faster so that is our pick:

```rust
...
#[tauri::command]
pub fn read_file(path: PathBuf) -> Result<String, String> {
    Ok(fs::read_to_string(path).map_err(|e| e.to_string())?)
}
...

```

With the file's content in hands, create the URL:

```typescript
<script lang="ts">
    import { PUBLIC_PATH_TO_PLUGIN } from "$env/static/public";
    import { invoke } from "@tauri-apps/api/core";

    async function createResource(): Promise<string | undefined> {
        try {
            const content = await invoke("read_file", {
                path: PUBLIC_PATH_TO_PLUGIN,
            });
            const blob = new Blob([content as string], {
                type: "application/javascript",
            });

            return URL.createObjectURL(blob);
        } catch (e) {
            console.log(e);
        }
    }
</script>

<svelte:head>
    {#await createResource() then url}
        <script src={url}></script>
    {/await}
</svelte:head>
<h1>Hello there 👽</h1>
```

And no errors this time. Let's try to do something in the plugin file:

```javascript
const h1 = document.createElement("h1");

h1.textContent = "General Kenobi";
h1.style.color = "green";
document.documentElement.appendChild(h1);
```

Now something green shows up in the screen. It's nice, and you can probably walk away with this, but
we still have one more approach to cover.

# Permissions and security stuff

Tauri has a robust permission system. I don't know everything about it, but I know enough to get us some scripts running.
What we are going to do here is change some rules in the [CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) to
allow local resources to be loaded.

Luckily for us, Tauri has exactly what we want: the `asset` protocol. I won't get into details but what you need
to know is that it allows us to load local resources from certain paths we specify.

> These two links from Tauri's docs might be useful [converfilesrc](https://v2.tauri.app/reference/javascript/api/namespacecore/#convertfilesrc) and [CSP](https://v2.tauri.app/security/csp/)

Add this to the `security` property of `tauri.config.json`

```json
"csp": {
    "script-src": "'self' asset: http://asset.localhost"
},
"assetProtocol": {
    "enable": true,
    "scope": ["$APPCONFIG/**"]
}
```

> You can find every possible value for `scope` [here](https://v2.tauri.app/reference/config/#fsscope)

With this we can load any JS script from the app's configuration directory. Let's try it.

```javascript
<script>
    import { PUBLIC_PATH_TO_PLUGIN } from "$env/static/public";
    import { convertFileSrc } from "@tauri-apps/api/core";

    const pluginPath = convertFileSrc(PUBLIC_PATH_TO_PLUGIN);
</script>

<svelte:head>
    <script src={pluginPath}></script>
</svelte:head>
<h1>Hello there 👽</h1>
```

The same green text should pop on the screen.

> Is worth saying that I changed `PUBLIC_PATH_TO_PLUGIN` to a string that points to `$HOME/.config/tauri-plugin-system/plugin.js`

# Going beyond

That was easy right? This next part is dedicated to some experiments and improvements I thought of. If you fell like
you already have enough for your use case, you can stop right here.

## Defining an interface

The first improvement we're making is creating a better interface for our plugins. That will make both sides happy: Plugin developers
know exactly what we expect, and we can just assume they did the right thing for the plugin to run. Our interface is quite trivial but
should be a good example:

```typescript
interface Plugin {
  sayHi(): string;
  sayHiTo(person: string): string;
}
```

Now let's make sure our plugin uses that interface:

```typescript
class MyPlugin {
  sayHi() {
    return "Hello there 👽";
  }

  sayHiTo(name) {
    return `Oh! You have a name? Hello ${name}`;
  }
}

export default new MyPlugin();
```

You might have noticed that I used a default export. That will be useful in the next section. I also think
this is a good moment to talk about the build process of a plugin.

The usual web development involves a lot of build steps: compiling, pre-processing, bundling and all the good stuff. But our
plugin system expects just one dumb JavaScript file. How is that even useful? Well, when you look at the installed plugins for an
application such as [Obsidian](https://obsidian.md/) you'll notice they are also just one JavaScript file. When you look at their
source code, they look just like any other JavaScript project with a lot of dependencies and tools. That is the result of the
many build steps. The core developer and the plugin developer have different responsibilities. One should make sure the code gets bundled
in one JavaScript file and the second should make sure that file is loaded.

You can leave a lot for plugin developers to worry about, but there is still a lot you can do to make things easy. Exposing nice type definitions
or the library itself is a good start. Look at [Obsidian Docs](https://docs.obsidian.md/Home) or [LogSeq Docs](https://plugins-doc.logseq.com/) for some
inspiration.

Creating some kind of plugin manager/installer is also very nice. You can just clone git repos and run some build commands.

## Better plugin loading

Right now, we're just using a static path to load plugins. Let's do something more useful. Every plugin
should have some information with them such as name, path and author. A good start is a JSON file. Let's name it `manifest.json`.

```rust
#[derive(serde::Deserialize, serde::Serialize)]
struct Manifest {
    name: String,
    author: String,
    repo: String,
}
```

There is also some information we can get from the file system, so let's wrap the manifest in something else:

```rust
#[derive(serde::Deserialize, serde::Serialize)]
struct Plugin {
    path: PathBuf,
    manifest: Manifest,
}
```

Now we expose a function to load them:

```rust
#[tauri::command]
fn find_plugins(config_dir: PathBuf) -> Result<Vec<Plugin>, String> {
    Ok(fs::read_dir(config_dir)
        .map_err(|err| err.to_string())?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let manifest = fs::read_to_string(entry.path().join(MANIFEST_FILE))
                .ok()
                .and_then(|contents| serde_json::from_str(&contents).ok())?;

            Some(Plugin {
                path: entry.path().join(PLUGIN_FILE),
                manifest,
            })
        })
        .collect())
}

```

On the frontend side, we need to create a few wrappers:

```typescript
type Manifest = {
  name: string;
  author: string;
  repo: string;
};

type PluginInfo = {
  path: string;
  manifest: Manifest;
};

export async function loadPlugins(): Promise<Array<Plugin>> {
  const pluginsInfo: Array<PluginInfo> = await invoke("find_plugins", {
    configDir: await path.appConfigDir(),
  });

  let plugins: Array<Plugin> = [];
  for (const info of pluginsInfo) {
    const url = convertFileSrc(info.path);
    const { default: plugin } = await import(url);
    plugins.push(plugin);
  }

  return plugins;
}
```

The local resource loading problem is already solved. We can just use a dynamic `ìmport` and expect everything to work. Remove that old `script` tag
with a static path and try something like this:

```typescript
{#await loadPlugins() then plugins}
    {#each plugins as plugin}
        <p>{plugin.sayHi()}</p>
        <p>{plugin.sayHiTo("Revan")}</p>
    {/each}
{/await}
```

## Using a VM for better security

At this point, the whole browser API is exposed. That should be fine for desktop applications as long as the users are aware, but after reading about [Figma's plugin system](https://www.figma.com/plugin-docs/how-plugins-run/), I thought it would be nice to isolate the plugins.

First thing we'll do, is checking that the whole thing is indeed exposed. Write this in your plugin:

```javascript
console.log(window);
```

That will log a huge object that includes `__TAURI_INTERNALS__` which basically is our whole Rust API. By using a VM is possible
to dictate exactly what plugins can use. This will isolate things, but you'll have to do some extra effort to think about how your API
can be used and what should be exposed.

What I'm going to expose is a simple command register:

```typescript
export interface Command {
  name: string;
  desc: string;
  exec(): void;
}

export class CommandsRegister {
  public commands = new Array<Command>();

  public addCmd(cmd: Command): void {
    this.commands.push(cmd);
  }
}

export const commandsRegister = new CommandsRegister();
```

I'll be using [QuickJS](https://bellard.org/quickjs/) to run the plugins. It is a C library so we need to use WASM. You could compile and load it yourself
but [quickjs-emscripten](https://github.com/justjake/quickjs-emscripten) can take care of that. I couldn't make `getQuickJS` to work, and because of that I created the instance
my self after looking at the [Vue example](https://github.com/justjake/quickjs-emscripten/tree/main/examples/vite-vue).

```typescript
import wasmLocation from "@jitl/quickjs-wasmfile-release-sync/wasm?url";
import {
  newQuickJSWASMModuleFromVariant,
  newVariant,
  RELEASE_SYNC,
} from "quickjs-emscripten";

export async function load() {
  const variant = newVariant(RELEASE_SYNC, {
    wasmLocation,
  });

  return await newQuickJSWASMModuleFromVariant(variant);
}
```

This next block is the largest I'm going to show you. It has a few functions
to create and dispose VM objects and a function to actually run a plugin:

```typescript
export async function runPlugin(info: PluginInfo): Promise<void> {
  const code: string = await invoke("read_file", { path: info.path });
  const quickJS = await load();
  const vm = quickJS.newContext();
  const api = API(vm);
  const print = printFn(vm);

  vm.setProp(vm.global, "API", api);
  vm.setProp(vm.global, "print", print);

  api.dispose();
  print.dispose();
  vm.evalCode(code).dispose();
  vm.dispose();
}

function printFn(vm: QuickJSContext): QuickJSHandle {
  return vm.newFunction("print", (...args) => {
    console.log(args.map(vm.dump));
  });
}

function API(vm: QuickJSContext): QuickJSHandle {
  const api = vm.newObject();
  const commands = commandsAPI(vm);

  vm.setProp(api, "commands", commands);
  commands.dispose();

  return api;
}

function commandsAPI(vm: QuickJSContext): QuickJSHandle {
  const commands = vm.newObject();
  const addCmd = vm.newFunction("addCmd", (cmd) => {
    commandsRegister.addCmd(vm.dump(cmd));
  });

  vm.setProp(commands, "addCmd", addCmd);
  addCmd.dispose();

  return commands;
}
```

> Always remember to call `dispose` to avoid memory leaks and other kinds of unexpected behavior

Let's create a new plugin that uses the exposed API:

```typescript
API.commands.addCmd({
  name: "Say hello",
  desc: "Says hello",
  exec: () => print("Hello there 👽"),
});

print(print);
print(API);
print(window);
```

I also called `print` with a few objects as a little sanity check. `window` shouldn't exist.

We're almost done. We just need to load and run plugins:

```typescript
export async function execPlugins(): Promise<void> {
  const pluginsInfo: Array<PluginInfo> = await invoke("find_plugins", {
    configDir: await path.appConfigDir(),
  });

  for (const info of pluginsInfo) {
    await runPlugin(info);
  }
}
```

In `+page.svelte` add something like this and check your console.

```typescript
{#await execPlugins()}
    {#each commandsRegister.commands as cmd}
        <p>{cmd.name}</p>
        <p>{cmd.desc}</p>
    {/each}
{/await}
```

# Conclusion

I really hope this blog post had some use for you. This is the first one
I'm actually publishing even though I wrote about 7 before this. Remember to check the [source code](https://github.com/marcos-brito/tauri-plugin-system) and good
luck with your project.

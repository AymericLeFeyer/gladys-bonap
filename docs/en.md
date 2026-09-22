# Bonap for Gladys Assistant

Bonap is a meal planner built on top of [Mealie](https://mealie.io) (recipes and meal plan). This integration:

- **installs Mealie and Bonap inside Gladys** if you don't run them yet, or connects to the ones you already have;
- adds a **"Next meal" widget** to your dashboard.

## Configuration

### Mealie

- **Install Mealie in Gladys** (default): Gladys starts Mealie, creates an API token and replaces the default admin password with a random one. The **"Show Mealie credentials"** button gives you the email and password to log in. The first start can take a few minutes.
- **I already have Mealie**: enter the URL of your Mealie (reachable from the Gladys machine, so not `localhost`) and an API token (Mealie → Profile → API Tokens).

### Bonap

- **Install Bonap in Gladys**: Bonap is started and wired to Mealie automatically.
- **I already have Bonap**: enter its URL. When it is `https://`, the widget shows an "Open Bonap" link.
- **No Bonap**: only the widget is used.

The addresses of the Mealie and Bonap installed by Gladys are shown in the "Access" section and in the Supervision screen ("Open" links).

## "Next meal" widget

On the dashboard, add the **Next meal** widget (Extensions section). It shows the next slot of the Mealie meal plan (breakfast until 10am, lunch until 2pm, dinner until 9pm) with the recipe picture and description.

## Good to know

- The Mealie and Bonap installed by Gladys are reachable on your local network, **with no authentication on the Bonap side**: never expose those ports to the Internet.
- **Uninstalling the integration deletes all its data, including the Mealie database.** Make a backup from Mealie (Settings → Backups) first.
- Mealie needs about 1 GB of memory.

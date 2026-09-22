# Bonap for Gladys Assistant

Bonap is a meal planner built on top of [Mealie](https://mealie.io) (recipes and meal plan). This integration:

- **installs Mealie and Bonap inside Gladys** if you don't run them yet, or connects to the ones you already have;
- adds two dashboard **widgets**: "Next meal" and "Meal plan";
- adds **scene actions** to use the menu in your scenes (Telegram message, announcement…).

## Configuration

### Mealie

- **Install Mealie in Gladys** (default): Gladys starts Mealie, creates an API token and replaces the default admin password with a random one. The **"Show Mealie credentials"** button gives you the email and password to log in. The first start can take a few minutes.
- **I already have Mealie**: enter the URL of your Mealie (reachable from the Gladys machine, so not `localhost`) and an API token (Mealie → Profile → API Tokens).

### Bonap

- **Install Bonap in Gladys**: Bonap is started and wired to Mealie automatically.
- **I already have Bonap**: enter its URL. When it is `https://`, the widget shows an "Open Bonap" link.
- **No Bonap**: only the widget is used.

The addresses of the Mealie and Bonap installed by Gladys are shown in the "Access" section and in the Supervision screen ("Open" links).

## Widgets

On the dashboard, switch to edit mode and add a widget from the Extensions section:

- **Next meal**: the next slot of the Mealie meal plan (breakfast until 10am, lunch until 2pm, snack until 5pm, dinner until 9pm) with the recipe picture and description. "Meals to show" setting: tick for instance only "Dinner" (empty = every meal).
- **Meal plan**: the upcoming meals over 1 to 7 days ("Days" setting, 3 by default), 8 rows at most.

Widgets refresh every 15 minutes.

## Scenes

Two actions are available in the scene editor ("Bonap" card):

- **Get the next meal** (fields: meal type, language) → outputs: `Meal found`, `Meal name`, `Meal type`, `Day`, `Date`, `Summary` (e.g. "Today · Dinner: Roast chicken").
- **Get the meals of the day** (fields: today or tomorrow, language) → outputs: `Number of meals`, `Meal names`, `Summary` (one line per meal, e.g. "Lunch: Quiche").

Example: trigger "Every day at 11am" → "Get the meals of the day" → "Send a message" with the summary as a variable.

## Good to know

- The Mealie and Bonap installed by Gladys are reachable on your local network, **with no authentication on the Bonap side**: never expose those ports to the Internet.
- **Uninstalling the integration deletes all its data, including the Mealie database.** Make a backup from Mealie (Settings → Backups) first.
- Mealie needs about 1 GB of memory.

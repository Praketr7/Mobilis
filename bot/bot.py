import os
import sys

# Try importing telegram modules, otherwise show stub details
try:
    from telegram.ext import Application, CommandHandler, MessageHandler, filters
except ImportError:
    Application = None

from handlers import (
    start_handler,
    hotspots_handler,
    junction_handler,
    deploy_handler,
    brief_handler,
    status_handler,
    text_query_handler,
)

def main():
    token = os.environ.get("TELEGRAM_TOKEN")
    
    if not token:
        print("\n" + "="*60)
        print("🤖 GRIDLOCK TELEGRAM BOT — DRY RUN / MOCK MODE ACTIVE")
        print("No TELEGRAM_TOKEN found in environment variables.")
        print("To launch the bot live, set the variable first:")
        print("   set TELEGRAM_TOKEN=your_token_here")
        print("="*60 + "\n")
        sys.exit(0)

    if not Application:
        print("Error: python-telegram-bot package is not installed.")
        print("Please install requirements using: pip install -r requirements.txt")
        sys.exit(1)

    print("🤖 Starting Gridlock Telegram Bot...")
    application = Application.builder().token(token).build()

    # Register handlers
    application.add_handler(CommandHandler("start", start_handler))
    application.add_handler(CommandHandler("hotspots", hotspots_handler))
    application.add_handler(CommandHandler("junction", junction_handler))
    application.add_handler(CommandHandler("deploy", deploy_handler))
    application.add_handler(CommandHandler("brief", brief_handler))
    application.add_handler(CommandHandler("status", status_handler))
    
    # Text search
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_query_handler))

    # Run bot
    application.run_polling()

if __name__ == "__main__":
    main()

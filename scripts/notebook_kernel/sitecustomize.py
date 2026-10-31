"""Set the Jupyter kernel event-loop policy required on Windows hosts."""

import asyncio
import os

if os.name == "nt":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

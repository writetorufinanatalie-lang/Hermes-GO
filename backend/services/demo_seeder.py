import datetime
from sqlalchemy.orm import Session
import models

MOCK_EMAILS = [
    {
        "id": "mock_1",
        "thread_id": "mock_thread_1",
        "sender": "Professor Smith <smith@university.edu>",
        "subject": "CS401: Final Project Submission Deadline Extended",
        "body": "Dear students, \n\nThe deadline for the CS401 Final Project has been extended by two days. It is now due this Friday at 11:59 PM. Please ensure your code is fully documented. I have attached the updated rubric.",
        "received_at_offset_hours": -2,
        "is_newsletter": False
    },
    {
        "id": "mock_2",
        "thread_id": "mock_thread_2",
        "sender": "Alex <alex.johnson@startup.io>",
        "subject": "Sync tomorrow?",
        "body": "Hey! Are you free for a quick 30-min sync tomorrow at 2:00 PM EST to discuss the new feature launch? Let me know and I'll send a calendar invite.",
        "received_at_offset_hours": -5,
        "is_newsletter": False
    },
    {
        "id": "mock_3",
        "thread_id": "mock_thread_3",
        "sender": "Billing <billing@cloudhosting.com>",
        "subject": "Action Required: Payment Failed",
        "body": "Your recent payment for the Cloud Hosting Pro plan has failed. Your card ending in 4021 was declined. Please update your billing information within 3 days or your account will be suspended.",
        "received_at_offset_hours": -12,
        "is_newsletter": False
    },
    {
        "id": "mock_4",
        "thread_id": "mock_thread_4",
        "sender": "Amazon.com <shipment-tracking@amazon.com>",
        "subject": "Your package has shipped!",
        "body": "Good news! Your order of 'Noise Cancelling Headphones' has shipped and is expected to arrive on August 20th. Tracking Number: TBA123456789.",
        "received_at_offset_hours": -24,
        "is_newsletter": False
    },
    {
        "id": "mock_5",
        "thread_id": "mock_thread_5",
        "sender": "Hacker Newsletter <weekly@hackernewsletter.com>",
        "subject": "Hacker Newsletter #680",
        "body": "Here are the top links this week...\n1. Someone built a computer inside Minecraft.\n2. AI agents are getting out of hand.\n\nTo unsubscribe, click here.",
        "received_at_offset_hours": -30,
        "is_newsletter": True,
        "list_unsubscribe_url": "http://example.com/unsubscribe/123"
    },
    {
        "id": "mock_6",
        "thread_id": "mock_thread_6",
        "sender": "Mom <mom@family.com>",
        "subject": "Dinner this weekend?",
        "body": "Hi honey, are you coming over for dinner this Sunday? Let me know so I can buy groceries. Love, Mom.",
        "received_at_offset_hours": -40,
        "is_newsletter": False
    },
    {
        "id": "mock_7",
        "thread_id": "mock_thread_7",
        "sender": "LinkedIn <messages-noreply@linkedin.com>",
        "subject": "You have 5 new connections",
        "body": "Grow your network. People are looking at your profile. Connect with them today.",
        "received_at_offset_hours": -48,
        "is_newsletter": True,
        "list_unsubscribe_url": "http://example.com/unsubscribe/456"
    },
    {
        "id": "mock_8",
        "thread_id": "mock_thread_8",
        "sender": "Doctor's Office <appointments@cityhealth.org>",
        "subject": "Appointment Reminder",
        "body": "This is a reminder for your dental cleaning on Thursday at 9:00 AM. Reply 'CONFIRM' to keep your appointment or 'CANCEL' to reschedule.",
        "received_at_offset_hours": -50,
        "is_newsletter": False
    },
    {
        "id": "mock_9",
        "thread_id": "mock_thread_9",
        "sender": "Sarah Jenkins <sjenkins@client.co>",
        "subject": "Re: Draft Proposal Review",
        "body": "Hi, I looked over the draft proposal. It looks good, but can we add a section about the timeline? Please send me the updated version by EOD Thursday.",
        "received_at_offset_hours": -60,
        "is_newsletter": False
    },
    {
        "id": "mock_10",
        "thread_id": "mock_thread_10",
        "sender": "Netflix <info@netflix.com>",
        "subject": "New shows added this week",
        "body": "Check out the new season of Stranger Things, now streaming. Grab some popcorn!",
        "received_at_offset_hours": -70,
        "is_newsletter": True,
        "list_unsubscribe_url": "http://example.com/unsubscribe/789"
    },
    {
        "id": "mock_11",
        "thread_id": "mock_thread_11",
        "sender": "Spotify <no-reply@spotify.com>",
        "subject": "Your Premium Receipt",
        "body": "Thanks for subscribing to Spotify Premium. Your card was charged $10.99. Order #991023.",
        "received_at_offset_hours": -80,
        "is_newsletter": False
    },
    {
        "id": "mock_12",
        "thread_id": "mock_thread_12",
        "sender": "GitHub <noreply@github.com>",
        "subject": "[hermes-go] Pull Request #42",
        "body": "User 'coder123' has opened a pull request: 'Fix calendar integration bug'. Please review it when you have a chance.",
        "received_at_offset_hours": -85,
        "is_newsletter": False
    },
    {
        "id": "mock_13",
        "thread_id": "mock_thread_13",
        "sender": "Uber Receipts <receipts@uber.com>",
        "subject": "Your Sunday morning trip with Uber",
        "body": "Here's your receipt for your ride to the airport. Total: $45.20.",
        "received_at_offset_hours": -90,
        "is_newsletter": False
    },
    {
        "id": "mock_14",
        "thread_id": "mock_thread_14",
        "sender": "Airbnb <automated@airbnb.com>",
        "subject": "Reservation confirmed for Austin",
        "body": "Pack your bags! Your stay in Austin is confirmed for Sept 12-15. Check-in instructions are inside.",
        "received_at_offset_hours": -100,
        "is_newsletter": False
    },
    {
        "id": "mock_15",
        "thread_id": "mock_thread_15",
        "sender": "Daily Dev <news@daily.dev>",
        "subject": "Top 10 React Libraries for 2026",
        "body": "Discover the best new React libraries to boost your productivity. Unsubscribe if you no longer wish to receive these.",
        "received_at_offset_hours": -110,
        "is_newsletter": True,
        "list_unsubscribe_url": "http://example.com/unsubscribe/999"
    }
]

def seed_demo_emails_if_needed(db: Session, current_user: models.User):
    # Check if there are any emails
    existing_count = db.query(models.Email).filter(models.Email.user_id == current_user.id).count()
    if existing_count > 0:
        return
        
    print(f"Seeding demo emails for user {current_user.email}...")
    now = datetime.datetime.now(datetime.timezone.utc)
    
    for m in MOCK_EMAILS:
        received_at = now + datetime.timedelta(hours=m["received_at_offset_hours"])
        
        email = models.Email(
            id=m["id"],
            user_id=current_user.id,
            thread_id=m["thread_id"],
            sender=m["sender"],
            subject=m["subject"],
            body=m["body"],
            received_at=received_at,
            priority="Low Priority", # Baseline, will be triaged by the agent
            is_newsletter=m["is_newsletter"],
            list_unsubscribe_url=m.get("list_unsubscribe_url")
        )
        db.add(email)
        
    db.commit()
    print("Demo emails seeded successfully.")

use chrono::{Timelike, Utc};
use chrono_tz::Europe::Paris;
use croner::Cron;

fn main() {
    println!("=== Testing Cron with Timezones ===\n");

    // Current time in UTC
    let now_utc = Utc::now();
    println!("Current time UTC: {}", now_utc);
    println!("Hour: {}, Minute: {}", now_utc.hour(), now_utc.minute());

    // Current time in Paris timezone
    let now_paris = now_utc.with_timezone(&Paris);
    println!("\nCurrent time Paris: {}", now_paris);
    println!("Hour: {}, Minute: {}", now_paris.hour(), now_paris.minute());

    // Test cron expression: 0 0 1 * * * (1am)
    let cron_expr = "0 0 1 * * *";
    println!("\n--- Testing cron: {} (every day at 1am) ---", cron_expr);

    // Parse cron
    let cron = Cron::new(cron_expr)
        .with_seconds_required()
        .parse()
        .expect("Failed to parse cron");

    // Find next occurrence using UTC
    println!("\n1. Using UTC timezone:");
    match cron.find_next_occurrence(&now_utc, false) {
        Ok(next) => {
            println!("   Next run (UTC): {}", next);
            println!("   Next run hour: {}", next.hour());
            let duration = next - now_utc;
            let hours = duration.num_hours();
            let minutes = duration.num_minutes() % 60;
            println!("   Time until next run: {}h {}m", hours, minutes);
        }
        Err(e) => println!("   Error: {}", e),
    }

    // Find next occurrence using Paris timezone
    println!("\n2. Using Paris timezone:");
    match cron.find_next_occurrence(&now_paris, false) {
        Ok(next) => {
            println!("   Next run (Paris): {}", next);
            println!("   Next run hour: {}", next.hour());
            let duration = next.signed_duration_since(now_paris);
            let hours = duration.num_hours();
            let minutes = duration.num_minutes() % 60;
            println!("   Time until next run: {}h {}m", hours, minutes);

            // Also show in UTC
            let next_utc = next.with_timezone(&Utc);
            println!("   Same time in UTC: {}", next_utc);
        }
        Err(e) => println!("   Error: {}", e),
    }

    println!("\n=== Explanation ===");
    println!("When using UTC: '0 0 1 * * *' means 1am UTC");
    println!("When using Paris: '0 0 1 * * *' means 1am Paris time (local time)");
    println!("\nFor users to set schedules in their local time, we need to:");
    println!("1. Let them specify their timezone in the UI");
    println!("2. Convert the cron expression to their timezone before calculating next run");
}

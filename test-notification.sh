#!/bin/bash
# test-notification.sh
# Quick bash script to test push notifications using curl

SERVER_URL="http://localhost:4000"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║   📱 NailsBySally Notification Test       ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Function to get tomorrow's date
get_tomorrow_date() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    date -v+1d +%Y-%m-%d
  else
    # Linux
    date -d "tomorrow" +%Y-%m-%d
  fi
}

# Function to create test appointment
create_test_appointment() {
  echo -e "${BLUE}🧪 Creating test appointment...${NC}"
  echo ""
  
  TOMORROW=$(get_tomorrow_date)
  
  JSON_DATA=$(cat <<EOF
{
  "fullName": "Test Client",
  "email": "test@example.com",
  "phone": "555-0123",
  "serviceId": "gel-manicure",
  "date": "$TOMORROW",
  "timeLabel": "2:00 PM",
  "notes": "🧪 TEST APPOINTMENT - Delete after testing!",
  "status": "confirmed"
}
EOF
)

  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d "$JSON_DATA" \
    "$SERVER_URL/api/appointments")
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  
  if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ Appointment created successfully!${NC}"
    echo ""
    echo "📋 Details:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Client:       Test Client"
    echo "Service:      Gel Manicure"
    echo "Date:         $TOMORROW"
    echo "Time:         2:00 PM"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo -e "${YELLOW}🔔 Push notification should be sent!${NC}"
    echo "   Check your browser/phone for the notification."
    echo ""
    echo "🔍 Server logs: pm2 logs nailsbysally"
    echo ""
    echo -e "${YELLOW}🗑️  Remember to delete this test appointment!${NC}"
    echo ""
  else
    echo -e "${RED}❌ Failed to create appointment${NC}"
    echo "HTTP Code: $HTTP_CODE"
    echo "Response: $BODY"
    echo ""
    echo "💡 Troubleshooting:"
    echo "   - Is server running? Run: pm2 status"
    echo "   - Check logs: pm2 logs nailsbysally"
    echo ""
    exit 1
  fi
}

# Function to send test notification only
send_test_notification() {
  echo -e "${BLUE}📤 Sending test push notification...${NC}"
  echo ""
  
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    "$SERVER_URL/api/push/test")
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  
  if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ Test notification sent!${NC}"
    echo ""
    
    # Try to parse JSON response
    SENT=$(echo "$BODY" | grep -o '"sent":[0-9]*' | cut -d':' -f2)
    FAILED=$(echo "$BODY" | grep -o '"failed":[0-9]*' | cut -d':' -f2)
    
    if [ ! -z "$SENT" ]; then
      echo "📊 Results:"
      echo "   Sent: $SENT"
      echo "   Failed: $FAILED"
      echo ""
    fi
    
    echo "🔔 Check your browser/phone for the notification!"
    echo ""
  elif [ "$HTTP_CODE" -eq 503 ]; then
    echo -e "${RED}❌ Push notifications not configured${NC}"
    echo ""
    echo "💡 VAPID keys might be missing from .env"
    echo "   Run: node generate-vapid-keys.js"
    echo "   Then add keys to .env and restart server"
    echo ""
    exit 1
  else
    echo -e "${RED}❌ Failed to send notification${NC}"
    echo "HTTP Code: $HTTP_CODE"
    echo "Response: $BODY"
    echo ""
    exit 1
  fi
}

# Parse command line arguments
case "$1" in
  --test-only|-t)
    send_test_notification
    ;;
  --help|-h)
    echo "Usage: ./test-notification.sh [options]"
    echo ""
    echo "Options:"
    echo "  (no args)        Create test appointment (triggers notification)"
    echo "  --test-only, -t  Just send test notification (no appointment)"
    echo "  --help, -h       Show this help"
    echo ""
    echo "Examples:"
    echo "  ./test-notification.sh              # Create test appointment"
    echo "  ./test-notification.sh --test-only  # Just test notification"
    echo ""
    exit 0
    ;;
  "")
    create_test_appointment
    ;;
  *)
    echo -e "${RED}Unknown option: $1${NC}"
    echo "Run with --help for usage information"
    exit 1
    ;;
esac

echo "✨ Done!"
echo ""
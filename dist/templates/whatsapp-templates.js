/**
 * Generate WhatsApp order confirmation message with rich formatting
 */
export function getWhatsAppOrderConfirmationTemplate(data) {
    const deliveryDate = data.estimatedDeliveryDate
        ? new Date(data.estimatedDeliveryDate).toLocaleDateString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        })
        : 'within 2-3 business days';
    // Create detailed item list for WhatsApp (can be longer than SMS)
    const itemsList = data.items.map((item, index) => `${index + 1}. ${item.name} - Qty: ${item.quantity} - ${item.price}`).join('\n');
    // Payment status with emoji
    const paymentStatusEmoji = data.paymentStatus === 'completed' ? '✅' : '⏳';
    const paymentMsg = data.paymentStatus === 'completed'
        ? '✅ *Payment Confirmed*'
        : `⏳ *Payment*: ${data.paymentMethod}`;
    return `🌸 *BOUQUET BAR - ORDER CONFIRMED* 🌸

Hello *${data.customerName}*! 👋

Your flower order has been confirmed and is being prepared with love by our expert florists.

━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *ORDER DETAILS*
━━━━━━━━━━━━━━━━━━━━━━━━━

🔹 *Order Number*: ${data.orderNumber}
🔹 *Total Amount*: ₹${data.total}
🔹 *Payment Method*: ${data.paymentMethod}
${paymentMsg}
📍 *Delivery Address*: ${data.deliveryAddress}

📦 *ITEMS ORDERED*:
${itemsList}

🚚 *DELIVERY INFORMATION*:
📅 *Expected Delivery*: ${deliveryDate}
📍 *Address*: ${data.deliveryAddress}

━━━━━━━━━━━━━━━━━━━━━━━━━
📱 *NEXT STEPS*
━━━━━━━━━━━━━━━━━━━━━━━━━

• You'll receive updates on your order status
• Our team will call before delivery
• Ensure someone is available to receive

━━━━━━━━━━━━━━━━━━━━━━━━━
📞 *NEED HELP?*
━━━━━━━━━━━━━━━━━━━━━━━━━

💬 WhatsApp: +91-98765-43210
📞 Call: +91-98765-43210
🌐 Track Order: Reply with "${data.orderNumber}"

Thank you for choosing Bouquet Bar! We're excited to make your special moments even more beautiful. 🌹✨

_This is an automated message. Please save our number for order updates._`;
}
/**
 * Generate WhatsApp order status update message
 */
export function getWhatsAppStatusUpdateTemplate(orderNumber, status, customerName, message, estimatedDelivery) {
    const statusEmojis = {
        confirmed: '✅',
        processing: '👩‍🌾',
        shipped: '🚚',
        delivered: '🎉',
        cancelled: '❌'
    };
    const statusMessages = {
        confirmed: '*Order Confirmed* - Our florists have started preparing your beautiful arrangement',
        processing: '*Being Prepared* - Your flowers are being carefully arranged by our expert team',
        shipped: '*Out for Delivery* - Your order is on its way to you!',
        delivered: '*Delivered Successfully* - Hope you love your beautiful flowers!',
        cancelled: '*Order Cancelled* - Your order has been cancelled as requested'
    };
    const statusEmoji = statusEmojis[status] || '📋';
    const statusMessage = statusMessages[status] || `Order status updated to: ${status}`;
    let deliveryInfo = '';
    if (status === 'shipped' && estimatedDelivery) {
        const deliveryDate = new Date(estimatedDelivery).toLocaleDateString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });
        deliveryInfo = `\n🕒 *Expected Delivery*: ${deliveryDate}`;
    }
    let customMessage = '';
    if (message) {
        customMessage = `\n\n💬 *Note*: ${message}`;
    }
    return `🌸 *BOUQUET BAR - ORDER UPDATE* 🌸

Hi *${customerName}*! 👋

${statusEmoji} ${statusMessage}

🔹 *Order*: ${orderNumber}${deliveryInfo}${customMessage}

━━━━━━━━━━━━━━━━━━━━━━━━━
📞 *NEED HELP?*
━━━━━━━━━━━━━━━━━━━━━━━━━

💬 Reply to this message
📞 Call: +91-98765-43210

Thank you for choosing Bouquet Bar! 🌹`;
}
/**
 * Generate WhatsApp delivery reminder message
 */
export function getWhatsAppDeliveryReminderTemplate(orderNumber, customerName, deliveryDate, deliveryAddress, timeSlot) {
    const deliveryDateStr = new Date(deliveryDate).toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });
    let timeInfo = '';
    if (timeSlot) {
        timeInfo = `\n🕒 *Time Slot*: ${timeSlot}`;
    }
    return `🌸 *BOUQUET BAR - DELIVERY TODAY* 🌸

Hi *${customerName}*! 👋

🚚 Your beautiful flowers are coming your way TODAY!

━━━━━━━━━━━━━━━━━━━━━━━━━
📦 *DELIVERY DETAILS*
━━━━━━━━━━━━━━━━━━━━━━━━━

🔹 *Order*: ${orderNumber}
📅 *Date*: ${deliveryDateStr}${timeInfo}
📍 *Address*: ${deliveryAddress}

━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ *IMPORTANT*
━━━━━━━━━━━━━━━━━━━━━━━━━

• Please ensure someone is available to receive
• Our delivery partner will call before arriving
• Have your order number ready

━━━━━━━━━━━━━━━━━━━━━━━━━
📞 *DELIVERY SUPPORT*
━━━━━━━━━━━━━━━━━━━━━━━━━

💬 WhatsApp: +91-98765-43210
📞 Call: +91-98765-43210

We can't wait for you to see your beautiful arrangement! 🌹✨`;
}
/**
 * Generate WhatsApp payment reminder message
 */
export function getWhatsAppPaymentReminderTemplate(orderNumber, customerName, amount, paymentMethod, dueDate) {
    let dueDateInfo = '';
    if (dueDate) {
        const dueDateStr = new Date(dueDate).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'long'
        });
        dueDateInfo = `\n📅 *Due Date*: ${dueDateStr}`;
    }
    return `🌸 *BOUQUET BAR - PAYMENT PENDING* 🌸

Hi *${customerName}*! 👋

⏳ We're waiting for your payment to proceed with your beautiful flower arrangement.

━━━━━━━━━━━━━━━━━━━━━━━━━
💳 *PAYMENT DETAILS*
━━━━━━━━━━━━━━━━━━━━━━━━━

🔹 *Order*: ${orderNumber}
💰 *Amount*: ${amount}
💳 *Method*: ${paymentMethod}${dueDateInfo}

━━━━━━━━━━━━━━━━━━━━━━━━━
💳 *COMPLETE PAYMENT*
━━━━━━━━━━━━━━━━━━━━━━━━━

Reply to this message with "PAY ${orderNumber}" or call us for assistance.

📞 *PAYMENT SUPPORT*:
💬 WhatsApp: +91-98765-43210
📞 Call: +91-98765-43210

Once payment is received, we'll immediately start preparing your order! 🌹`;
}
/**
 * Generate WhatsApp promotional message
 */
export function getWhatsAppPromotionalTemplate(customerName, offer, validUntil, couponCode, imageUrl) {
    const validDate = new Date(validUntil).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    let couponInfo = '';
    if (couponCode) {
        couponInfo = `\n🎫 *Coupon Code*: ${couponCode}`;
    }
    return `🌸 *BOUQUET BAR - SPECIAL OFFER* 🌸

Hi *${customerName}*! 👋

🎉 ${offer}

━━━━━━━━━━━━━━━━━━━━━━━━━
🛒 *OFFER DETAILS*
━━━━━━━━━━━━━━━━━━━━━━━━━

📅 *Valid Until*: ${validDate}${couponInfo}

━━━━━━━━━━━━━━━━━━━━━━━━━
🛍️ *SHOP NOW*
━━━━━━━━━━━━━━━━━━━━━━━━━

💬 Reply "CATALOG" to see our latest collection
📞 Call: +91-98765-43210
🌐 Visit our website

Don't miss out on this beautiful opportunity! 🌹✨

*Terms & Conditions Apply. Offer valid for limited time only.*`;
}
/**
 * Generate WhatsApp order cancellation message
 */
export function getWhatsAppOrderCancellationTemplate(orderNumber, customerName, total, address, paymentMethod, refundAmount, refundMethod, estimatedRefundDays) {
    let refundInfo = '';
    if (refundAmount && refundMethod) {
        const refundDays = estimatedRefundDays || 5;
        refundInfo = `\n━━━━━━━━━━━━━━━━━━━━━━━━━
💰 *REFUND DETAILS*
━━━━━━━━━━━━━━━━━━━━━━━━━

💵 *Amount*: ${refundAmount}
💳 *Method*: ${refundMethod}
📅 *Timeline*: ${refundDays} business days

Your refund will be processed automatically and you'll receive a confirmation message once completed.`;
    }
    return `🌸 *BOUQUET BAR - ORDER CANCELLED* 🌸

Hi *${customerName}*! 👋

❌ Your order has been successfully cancelled as requested.

━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *CANCELLATION DETAILS*
━━━━━━━━━━━━━━━━━━━━━━━━━

🔹 *Order Number*: ${orderNumber}
💰 *Total Amount*: ₹${total}
💳 *Payment Method*: ${paymentMethod}
📍 *Delivery Address*: ${address}
⏰ *Cancelled*: ${new Date().toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    })}${refundInfo}

━━━━━━━━━━━━━━━━━━━━━━━━━
😊 *WE'RE HERE FOR YOU*
━━━━━━━━━━━━━━━━━━━━━━━━━

We're sorry to see you cancel your order, but we understand that plans can change. We'd love to serve you again in the future!

🌹 Browse our collection anytime
💬 Reply for recommendations
📞 Call: +91-98765-43210

Thank you for choosing Bouquet Bar. We hope to make your next special moment beautiful! ✨`;
}
/**
 * Generate WhatsApp points awarded message
 */
export function getWhatsAppPointsAwardedTemplate(customerName, pointsAwarded, totalPoints, orderNumber, nextMilestone) {
    let milestoneInfo = '';
    if (nextMilestone) {
        const pointsNeeded = nextMilestone.points - totalPoints;
        milestoneInfo = `\n🎯 *Next Milestone*: ${pointsNeeded} more points for ${nextMilestone.reward}`;
    }
    return `🌸 *BOUQUET BAR - POINTS EARNED* 🌸

Hi *${customerName}*! 👋

🎉 Congratulations! You've earned reward points for your recent purchase.

━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 *POINTS SUMMARY*
━━━━━━━━━━━━━━━━━━━━━━━━━

✨ *Points Earned*: ${pointsAwarded} points
🔹 *Order*: ${orderNumber}
💎 *Total Points*: ${totalPoints} points${milestoneInfo}

━━━━━━━━━━━━━━━━━━━━━━━━━
💰 *HOW TO REDEEM*
━━━━━━━━━━━━━━━━━━━━━━━━━

• Use points at checkout for instant discounts
• 100 points = ₹10 discount
• Points never expire
• Combine with offers for extra savings

━━━━━━━━━━━━━━━━━━━━━━━━━
🛒 *SHOP AGAIN*
━━━━━━━━━━━━━━━━━━━━━━━━━

💬 Reply "CATALOG" for our latest collection
📞 Call: +91-98765-43210
🌐 Visit our website

Thank you for being a valued customer! 🌹✨`;
}
/**
 * Generate WhatsApp order tracking message
 */
export function getWhatsAppOrderTrackingTemplate(orderNumber, customerName, currentStatus, estimatedDelivery, trackingSteps) {
    let deliveryInfo = '';
    if (estimatedDelivery) {
        const deliveryDate = new Date(estimatedDelivery).toLocaleDateString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });
        deliveryInfo = `\n📅 *Expected Delivery*: ${deliveryDate}`;
    }
    let trackingInfo = '';
    if (trackingSteps && trackingSteps.length > 0) {
        trackingInfo = '\n━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 *ORDER PROGRESS*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
        trackingSteps.forEach(step => {
            const emoji = step.completed ? '✅' : '⏳';
            const timestamp = step.timestamp ?
                ` (${new Date(step.timestamp).toLocaleDateString('en-IN')})` : '';
            trackingInfo += `${emoji} ${step.step}${timestamp}\n`;
        });
    }
    return `🌸 *BOUQUET BAR - ORDER TRACKING* 🌸

Hi *${customerName}*! 👋

Here's the latest update on your order:

━━━━━━━━━━━━━━━━━━━━━━━━━
📦 *ORDER STATUS*
━━━━━━━━━━━━━━━━━━━━━━━━━

🔹 *Order*: ${orderNumber}
📋 *Current Status*: ${currentStatus}${deliveryInfo}${trackingInfo}

━━━━━━━━━━━━━━━━━━━━━━━━━
📞 *NEED UPDATES?*
━━━━━━━━━━━━━━━━━━━━━━━━━

💬 Reply "STATUS ${orderNumber}"
📞 Call: +91-98765-43210

We'll keep you updated every step of the way! 🌹`;
}

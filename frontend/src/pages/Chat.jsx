import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Chat.css';

const Chat = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const messagesEndRef = useRef(null);

  // Active conversations list state
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messageText, setMessageText] = useState('');

  // Scroll to bottom of message list
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Initialize conversations from localStorage or seed defaults
  useEffect(() => {
    if (!user) return;

    const storedChats = JSON.parse(localStorage.getItem('campusmesh_chats') || '[]');
    let currentChats = [...storedChats];

    // Seed default conversations if empty to show features
    if (currentChats.length === 0) {
      currentChats = [
        {
          id: 'dummy-rahul',
          name: 'Rahul Kumar',
          lastMessage: 'Sure, canteen works. Bring exact change.',
          lastMessageTime: '04:20 PM',
          messages: [
            { sender: 'other', text: 'Hey, are you still looking for the Calculus textbook?', time: '04:15 PM' },
            { sender: 'me', text: 'Yes, is it still available? I can meet you tomorrow.', time: '04:18 PM' },
            { sender: 'other', text: 'Sure, canteen works. Bring exact change.', time: '04:20 PM' }
          ]
        },
        {
          id: 'dummy-priya',
          name: 'Priya Sharma',
          lastMessage: 'No problem, see you there!',
          lastMessageTime: 'Yesterday',
          messages: [
            { sender: 'me', text: 'Hi Priya, is the lab coat clean?', time: 'Yesterday' },
            { sender: 'other', text: 'Yes! Washed it yesterday. Fits medium size.', time: 'Yesterday' },
            { sender: 'me', text: 'Perfect. I will pick it up at the chemistry block.', time: 'Yesterday' },
            { sender: 'other', text: 'No problem, see you there!', time: 'Yesterday' }
          ]
        }
      ];
      localStorage.setItem('campusmesh_chats', JSON.stringify(currentChats));
    }

    // Check if we arrived via "Contact Seller / Chat" from Home Page
    const sellerId = searchParams.get('sellerId');
    const sellerName = searchParams.get('sellerName');
    const listingTitle = searchParams.get('listingTitle');

    if (sellerId && sellerName && listingTitle) {
      // Check if conversation already exists
      const existingConvIndex = currentChats.findIndex(c => c.id === sellerId);
      
      const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (existingConvIndex > -1) {
        // Conversation exists, select it
        setActiveConversationId(sellerId);
      } else {
        // Create new conversation
        const newChat = {
          id: sellerId,
          name: sellerName,
          lastMessage: `Inquiry about: "${listingTitle}"`,
          lastMessageTime: currentTime,
          messages: [
            { 
              sender: 'me', 
              text: `Hi ${sellerName}, I am interested in renting/buying your listing: "${listingTitle}". Is it still available?`, 
              time: currentTime 
            },
            { 
              sender: 'other', 
              text: `Hey! Thanks for reaching out. Yes, the "${listingTitle}" is still available! When are you free to meet on campus?`, 
              time: currentTime 
            }
          ]
        };
        
        currentChats.unshift(newChat);
        localStorage.setItem('campusmesh_chats', JSON.stringify(currentChats));
        setActiveConversationId(sellerId);
      }
      
      // Clear parameters from URL
      setSearchParams({});
    } else if (currentChats.length > 0 && !activeConversationId) {
      // By default, select the first chat
      setActiveConversationId(currentChats[0].id);
    }

    setConversations(currentChats);
  }, [user, searchParams, setSearchParams]);

  // Scroll to bottom whenever active conversation or messages change
  useEffect(() => {
    scrollToBottom();
  }, [activeConversationId, conversations]);

  const activeConv = conversations.find(c => c.id === activeConversationId);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageText.trim() || !activeConversationId) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMessage = {
      sender: 'me',
      text: messageText,
      time: timeStr
    };

    // Update state & localStorage
    const updatedChats = conversations.map(c => {
      if (c.id === activeConversationId) {
        return {
          ...c,
          lastMessage: messageText,
          lastMessageTime: timeStr,
          messages: [...c.messages, userMessage]
        };
      }
      return c;
    });

    setConversations(updatedChats);
    localStorage.setItem('campusmesh_chats', JSON.stringify(updatedChats));
    setMessageText('');

    // Trigger simulated reply from other student after 1.5s
    const activePartnerName = activeConv ? activeConv.name : 'Student';
    setTimeout(() => {
      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      const replies = [
        `Hey, that sounds good! I can meet you tomorrow afternoon in the library foyer if that works?`,
        `Perfect. Let me check my class timetable and I will text you back.`,
        `Sounds like a plan. I will be near the DBIT main gate. Just ping me when you arrive.`,
        `Awesome! Yes, please. I prefer GPay or cash. Let's meet at 1:00 PM near the canteen.`,
        `Great. I will bring the item. See you tomorrow!`
      ];
      
      const randomReply = replies[Math.floor(Math.random() * replies.length)];
      const partnerReply = {
        sender: 'other',
        text: randomReply,
        time: replyTime
      };

      const finalChats = updatedChats.map(c => {
        if (c.id === activeConversationId) {
          return {
            ...c,
            lastMessage: randomReply,
            lastMessageTime: replyTime,
            messages: [...c.messages, partnerReply]
          };
        }
        return c;
      });

      setConversations(finalChats);
      localStorage.setItem('campusmesh_chats', JSON.stringify(finalChats));
    }, 1500);
  };

  if (!user) return null;

  return (
    <div className="chat-container">
      {/* Conversations Sidebar */}
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <h2>Active Chats</h2>
        </div>
        <div className="conversations-list">
          {conversations.map(conv => (
            <div 
              key={conv.id} 
              onClick={() => setActiveConversationId(conv.id)}
              className={`conversation-item ${conv.id === activeConversationId ? 'active' : ''}`}
            >
              <div className="conv-avatar">
                {conv.name.charAt(0).toUpperCase()}
              </div>
              <div className="conv-details">
                <div className="conv-header">
                  <span className="conv-name">{conv.name}</span>
                  <span className="conv-time">{conv.lastMessageTime}</span>
                </div>
                <div className="conv-last-msg">{conv.lastMessage}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="chat-main">
        {activeConv ? (
          <>
            {/* Active Chat Header */}
            <div className="chat-header">
              <div className="chat-header-user">
                <div className="conv-avatar">
                  {activeConv.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="chat-header-name">{activeConv.name}</div>
                  <div className="chat-header-status">Online</div>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="chat-messages-area">
              {activeConv.messages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`message-bubble-wrapper ${msg.sender === 'me' ? 'sent' : 'received'}`}
                >
                  <div className="message-bubble">
                    {msg.text}
                  </div>
                  <span className="message-time">{msg.time}</span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="chat-input-area">
              <form onSubmit={handleSendMessage} className="chat-input-form">
                <input 
                  type="text" 
                  className="chat-text-input" 
                  placeholder="Type your message here..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                />
                <button type="submit" className="btn btn-primary chat-send-btn">
                  Send
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="chat-empty-state">
            <span className="chat-empty-icon">💬</span>
            <h3>No Active Conversation</h3>
            <p className="text-muted" style={{ marginTop: '0.5rem' }}>
              Select a conversation from the sidebar or click "Chat" on a marketplace listing to begin.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;

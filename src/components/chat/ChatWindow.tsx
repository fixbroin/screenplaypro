"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, UserCircle, MessageSquareText, XIcon, Loader2, Check, CheckCheck, Bot, Ban, ShieldAlert } from 'lucide-react';
import type { ChatMessage, ChatSession, FirestoreNotification } from '@/types/firestore';
import { Timestamp, doc, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, setDoc, serverTimestamp, getDoc, getDocs, limit } from "firebase/firestore";
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import { useToast } from '@/hooks/use-toast';
import { ADMIN_EMAIL } from '@/contexts/AuthContext';
import { chatWithAgent, type ChatHistoryItem } from '@/ai/flows/chatWithAgentFlow';
import { triggerPushNotification } from '@/lib/fcmUtils';
import { cn, getTimestampMillis } from '@/lib/utils';

interface ChatWindowProps {
  onClose: () => void;
  otherUserId?: string; // If provided, chat with this specific user (e.g., artist)
  otherUserName?: string;
  otherUserPhotoUrl?: string;
}

const ADMIN_FALLBACK_NAME = "Support";
const ADMIN_FALLBACK_AVATAR_INITIAL = "S";

// Function to find URLs in text and wrap them in anchor tags
const linkify = (text: string) => {
    const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])|(\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    return text.replace(urlRegex, (url) => {
        const fullUrl = url.startsWith('www.') ? `http://${url}` : url;
        return `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer" class="text-primary font-medium underline hover:text-primary/80 transition-colors">${url}</a>`;
    });
};


export default function ChatWindow({ onClose, otherUserId, otherUserName, otherUserPhotoUrl }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const scrollAreaRootRef = useRef<HTMLDivElement>(null);
  const { user: currentUser } = useAuth();
  const { settings: globalSettings, isLoading: isLoadingGlobalSettings } = useGlobalSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [otherUser, setOtherUser] = useState<{displayName?: string | null, photoURL?: string | null, uid?: string | null}>({
    displayName: otherUserName || ADMIN_FALLBACK_NAME,
    photoURL: otherUserPhotoUrl || null,
    uid: otherUserId || null,
  });
  const [isLoadingOtherUser, setIsLoadingOtherUser] = useState(true);
  const [blockedBy, setBlockedBy] = useState<string[]>([]);

  useEffect(() => {
    if (globalSettings?.chatNotificationSoundUrl) {
      audioRef.current = new Audio(globalSettings.chatNotificationSoundUrl);
      audioRef.current.load();
    } else {
      audioRef.current = null;
    }
  }, [globalSettings?.chatNotificationSoundUrl]);


  const getChatSessionId = useCallback((userId1: string, userId2: string): string => {
    return [userId1, userId2].sort().join('_');
  }, []);

  const chatSessionId = currentUser && otherUser.uid ? getChatSessionId(currentUser.uid, otherUser.uid) : null;

  useEffect(() => {
    const fetchOtherUser = async () => {
        setIsLoadingOtherUser(true);
      
      // If otherUserId was passed as prop, we use it directly
      if (otherUserId) {
        setOtherUser({
          displayName: otherUserName || "User",
          photoURL: otherUserPhotoUrl || null,
          uid: otherUserId
        });
        setIsLoadingOtherUser(false);
        return;
      }

      // Otherwise, fallback to Support Admin logic
      if (globalSettings?.adminUserUidForChat) {
         const adminDocSnap = await getDoc(doc(db, "users", globalSettings.adminUserUidForChat));
         if (adminDocSnap.exists()) {
            const adminData = adminDocSnap.data();
            setOtherUser({ displayName: adminData.displayName, photoURL: adminData.photoURL, uid: adminDocSnap.id });
            setIsLoadingOtherUser(false);
            return;
         }
      }
      const adminQuery = query(collection(db, "users"), where("email", "==", ADMIN_EMAIL), limit(1));
      const adminSnapshot = await getDocs(adminQuery);
      if (!adminSnapshot.empty) {
        const adminData = adminSnapshot.docs[0].data();
        const adminUid = adminSnapshot.docs[0].id;
        setOtherUser({ displayName: adminData.displayName || null, photoURL: adminData.photoURL || null, uid: adminUid });
      } else {
        setOtherUser({ displayName: ADMIN_FALLBACK_NAME, photoURL: null, uid: 'admin_master_id' });
      }
      setIsLoadingOtherUser(false);
    };

    if (!isLoadingGlobalSettings) {
        fetchOtherUser();
    }
  }, [globalSettings, isLoadingGlobalSettings, otherUserId, otherUserName, otherUserPhotoUrl]);


  useEffect(() => {
    if (!currentUser || !chatSessionId || !otherUser.uid || isLoadingOtherUser) {
      if(!isLoadingOtherUser && !otherUser.uid) setIsLoadingMessages(false);
      return;
    }
    setIsLoadingMessages(true);
    const messagesRef = collection(db, 'chats', chatSessionId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      const fetchedMessages = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ChatMessage));
      
      let newIncomingMessageReceived = false;
      for (const msg of fetchedMessages) {
        // Correctly check if it's an incoming message for the current user
        if (msg.senderId !== currentUser.uid && !msg.isReadByUser && msg.id) {
          newIncomingMessageReceived = true;
          break; 
        }
      }

      setMessages(fetchedMessages);
      setIsLoadingMessages(false);

      // Mark incoming messages as read
      for (const msg of fetchedMessages) {
        if (msg.senderId !== currentUser.uid && !msg.isReadByUser && msg.id) {
          const msgRef = doc(db, 'chats', chatSessionId, 'messages', msg.id);
          await updateDoc(msgRef, { isReadByUser: true });
        }
      }

      if (newIncomingMessageReceived && audioRef.current) {
        audioRef.current.play().catch(e => console.warn("ChatWindow: Audio play failed:", e));
      }
      
      const sessionDocRef = doc(db, 'chats', chatSessionId);
      const sessionSnap = await getDoc(sessionDocRef);
      if (sessionSnap.exists()) {
        const sessionData = sessionSnap.data() as ChatSession;
        // Reset unread count based on who is viewing
        if (sessionData.userId === currentUser.uid) {
            await updateDoc(sessionDocRef, { userUnreadCount: 0, updatedAt: serverTimestamp() });
        } else {
            await updateDoc(sessionDocRef, { adminUnreadCount: 0, updatedAt: serverTimestamp() });
        }
      } else if (currentUser && otherUser.uid) {
        await setDoc(sessionDocRef, {
            userId: currentUser.uid,
            adminId: otherUser.uid,
            userUnreadCount: 0,
            adminUnreadCount: 0,
            aiAgentActive: !otherUserId, // Only active for support chat
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
            participants: [currentUser.uid, otherUser.uid].filter(Boolean),
        }, { merge: true });
      }

    }, (error) => {
      console.error(`ChatWindow: Error fetching messages for session ${chatSessionId}:`, error);
      setIsLoadingMessages(false);
    });

    return () => {
        unsubscribe();
    };
  }, [currentUser, chatSessionId, otherUser.uid, isLoadingOtherUser]);

  // Listen to the parent chat session for block status in real-time
  useEffect(() => {
    if (!currentUser || !chatSessionId || !otherUser.uid || isLoadingOtherUser) {
      return;
    }

    const sessionDocRef = doc(db, 'chats', chatSessionId);

    const unsubscribeSession = onSnapshot(sessionDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const sessionData = docSnap.data() as ChatSession;
        setBlockedBy(sessionData.blockedBy || []);
      }
    }, (error) => {
      console.error("ChatWindow: Error listening to session:", error);
    });

    return () => {
      unsubscribeSession();
    };
  }, [currentUser, chatSessionId, otherUser.uid, isLoadingOtherUser]);

  useEffect(() => {
    if (scrollAreaRootRef.current) {
      const viewport = scrollAreaRootRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages, isLoadingMessages, isAiTyping]);

  const isBlocked = currentUser && blockedBy.includes(currentUser.uid);
  const hasBlocked = otherUser.uid && blockedBy.includes(otherUser.uid);
  const isChatRestricted = isBlocked || hasBlocked;

  const handleBlockUser = async () => {
    if (!currentUser || !chatSessionId) return;
    try {
      const sessionRef = doc(db, "chats", chatSessionId);
      const newBlockedBy = [...blockedBy];
      const isUnblocking = newBlockedBy.includes(currentUser.uid);
      
      if (isUnblocking) {
        // Unblock
        const updated = newBlockedBy.filter(id => id !== currentUser.uid);
        await updateDoc(sessionRef, { blockedBy: updated });
        toast({ title: "User Unblocked", description: "You can now send and receive messages." });
        
        // Push notification for unblock
        if (otherUser.uid) {
          triggerPushNotification({
            userId: otherUser.uid,
            title: "Chat Unrestricted",
            body: `${currentUser.displayName || 'The other user'} has unblocked the conversation.`,
            href: `/chat?with=${currentUser.uid}`
          }).catch(err => console.error("Error sending unblock push:", err));
        }
      } else {
        // Block
        newBlockedBy.push(currentUser.uid);
        await updateDoc(sessionRef, { blockedBy: newBlockedBy });
        toast({ title: "User Blocked", description: "You will no longer receive messages from this user." });

        // Push notification for block
        if (otherUser.uid) {
          triggerPushNotification({
            userId: otherUser.uid,
            title: "Chat Restricted",
            body: `You have been blocked by ${currentUser.displayName || 'this user'}.`,
          }).catch(err => console.error("Error sending block push:", err));
        }
      }
    } catch (e) {
      console.error("Block error:", e);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser || !chatSessionId || !otherUser.uid || isChatRestricted) {
        return;
    }

    const messageData: Omit<ChatMessage, 'id'> = {
      chatSessionId: chatSessionId,
      senderId: currentUser.uid,
      senderType: 'user', // We might want to refine this if artist is sending
      text: newMessage,
      timestamp: Timestamp.now(),
      isReadByAdmin: false,
      isReadByUser: false,
    };

    const tempNewMessage = newMessage;
    setNewMessage('');
    
    try {
      const messagesRef = collection(db, 'chats', chatSessionId, 'messages');
      await addDoc(messagesRef, messageData);

      const sessionDocRef = doc(db, 'chats', chatSessionId);
      const sessionSnap = await getDoc(sessionDocRef);
      const currentSessionData = sessionSnap.exists() ? sessionSnap.data() as ChatSession : undefined;
      
      const isSupportChat = !otherUserId;
      const isGlobalAiEnabled = isSupportChat && (globalSettings?.isAiChatBotEnabled ?? false);

      // Determine who gets the unread count increase
      const isCurrentUserSessionUser = currentSessionData?.userId === currentUser.uid;
      
      await setDoc(sessionDocRef, {
        userId: isCurrentUserSessionUser ? currentUser.uid : (currentSessionData?.userId || otherUser.uid),
        userName: isCurrentUserSessionUser ? (currentUser.displayName || null) : (currentSessionData?.userName || otherUser.displayName || null),
        userPhotoUrl: isCurrentUserSessionUser ? (currentUser.photoURL || null) : (currentSessionData?.userPhotoUrl || otherUser.photoURL || null),
        adminId: isCurrentUserSessionUser ? (currentSessionData?.adminId || otherUser.uid) : currentUser.uid,
        adminName: isCurrentUserSessionUser ? (currentSessionData?.adminName || otherUser.displayName || null) : (currentUser.displayName || null),
        adminPhotoUrl: isCurrentUserSessionUser ? (currentSessionData?.adminPhotoUrl || otherUser.photoURL || null) : (currentUser.photoURL || null),
        lastMessageText: tempNewMessage.substring(0, 50),
        lastMessageTimestamp: messageData.timestamp,
        lastMessageSenderId: currentUser.uid,
        participants: [currentUser.uid, otherUser.uid].filter(p => p !== null && p !== undefined),
        userUnreadCount: isCurrentUserSessionUser ? 0 : (currentSessionData?.userUnreadCount || 0) + 1,
        adminUnreadCount: isCurrentUserSessionUser ? (currentSessionData?.adminUnreadCount || 0) + 1 : 0,
        updatedAt: messageData.timestamp,
        ...(currentSessionData ? {} : { createdAt: messageData.timestamp })
      }, { merge: true });
      
      // Notify other user
      if (otherUser.uid && otherUser.uid !== 'fallback_admin_uid' && otherUser.uid !== 'admin_master_id') {
        const notificationData: any = {
          userId: otherUser.uid,
          title: `New Message from ${currentUser.displayName || currentUser.email}`,
          message: `${tempNewMessage.substring(0, 30)}${tempNewMessage.length > 30 ? "..." : ""}`,
          type: 'info',
          read: false,
          createdAt: Timestamp.now(),
        };
        if (currentUser.uid) {
          notificationData.href = `/chat?with=${currentUser.uid}`;
        }
        await addDoc(collection(db, "userNotifications"), notificationData);
        
        triggerPushNotification({
          userId: otherUser.uid,
          title: `Message from ${currentUser.displayName || currentUser.email}`,
          body: tempNewMessage,
          href: `/chat?with=${currentUser.uid}`
        });
      }
      
      if (isGlobalAiEnabled) {
        setIsAiTyping(true);
        const MAX_HISTORY = 16;
        const trimmed = messages.slice(-MAX_HISTORY);

        const historyForAi: ChatHistoryItem[] = trimmed.map(msg => ({
          role: msg.senderId === currentUser.uid ? 'user' : 'model',
          content: [{ text: msg.text || '' }]
        }));

        const aiResponse = await chatWithAgent({
          history: historyForAi,
          message: tempNewMessage,
          userId: currentUser.uid,
        });
        setIsAiTyping(false);

        if (aiResponse.response && aiResponse.isSilent !== true) {
          const aiMessageData: Omit<ChatMessage, 'id'> = {
            chatSessionId: chatSessionId,
            senderId: 'ai_agent',
            senderType: 'ai',
            text: aiResponse.response,
            timestamp: Timestamp.now(),
            isReadByUser: false,
          };
          await addDoc(messagesRef, aiMessageData);
          
          await updateDoc(sessionDocRef, {
              lastMessageText: aiResponse.response.substring(0, 50),
              lastMessageTimestamp: aiMessageData.timestamp,
              lastMessageSenderId: 'ai_agent',
              userUnreadCount: (currentSessionData?.userUnreadCount || 0) + 1,
              updatedAt: aiMessageData.timestamp,
          });
        }
      }

    } catch (error) {
      console.error("ChatWindow: Error sending message:", error);
      setIsAiTyping(false);
    }
  };

  if (!currentUser) {
    return (
      <Card className="h-full flex flex-col shadow-xl rounded-2xl border-none overflow-hidden bg-background">
        <CardHeader className="p-4 border-b bg-primary/5 flex flex-row items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-full">
              <UserCircle className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-lg font-headline font-semibold">Chat</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors">
            <XIcon className="h-5 w-5" />
          </Button>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
             <MessageSquareText className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm font-medium">Please login to start a conversation.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoadingGlobalSettings || isLoadingOtherUser || !otherUser.uid) {
     return (
      <Card className="h-full flex flex-col shadow-xl rounded-2xl border-none overflow-hidden bg-background">
        <CardHeader className="p-4 border-b bg-primary/5 flex flex-row items-center justify-between">
          <div className="flex items-center space-x-3">
             <div className="h-10 w-10 bg-muted animate-pulse rounded-full" />
             <div className="space-y-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                <div className="h-3 w-16 bg-muted animate-pulse rounded" />
             </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <XIcon className="h-5 w-5" />
          </Button>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground animate-pulse">Initializing secure connection...</p>
          </div>
        </CardContent>
      </Card>
     );
  }

  return (
    <Card className="h-full flex flex-col shadow-2xl rounded-2xl border-none overflow-hidden bg-background ring-1 ring-border">
      <CardHeader className="p-4 border-b bg-background sticky top-0 z-10 flex flex-row items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Avatar className="h-10 w-10 border-2 border-primary/10 ring-2 ring-background">
              <AvatarImage src={otherUser.photoURL || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold">
                {otherUser.displayName?.charAt(0) || ADMIN_FALLBACK_AVATAR_INITIAL}
              </AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white" />
          </div>
          <div className="flex flex-col">
            <CardTitle className="text-base font-headline font-bold leading-tight">
              {otherUser.displayName || ADMIN_FALLBACK_NAME}
            </CardTitle>
            <span className="text-[10px] text-green-600 font-semibold uppercase tracking-wider flex items-center">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />
              Active Now
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {otherUserId && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleBlockUser} 
              className={cn("rounded-full transition-colors", isBlocked ? "text-destructive" : "text-muted-foreground hover:text-destructive")} 
              title={isBlocked ? "Unblock User" : "Block User"}
            >
              <Ban className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-destructive/10 hover:text-destructive transition-all duration-200">
            <XIcon className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-grow overflow-hidden relative bg-background">
        {isChatRestricted && (
          <div className="absolute inset-0 z-20 bg-background/60 backdrop-blur-[2px] flex items-center justify-center p-2 text-center">
            <div className="bg-card border shadow-xl rounded-3xl p-8 max-w-sm animate-in zoom-in duration-300">
              <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-bold mb-2">Chat Restricted</h3>
              <p className="text-sm text-muted-foreground">
                {isBlocked 
                  ? "You have blocked this conversation. Unblock to resume." 
                  : `You have been blocked by ${otherUser.displayName || 'this user'}.`}
              </p>
              {isBlocked && (
                <Button variant="outline" className="mt-6 rounded-xl" onClick={handleBlockUser}>Unblock User</Button>
              )}
            </div>
          </div>
        )}
        <ScrollArea className="h-full px-4 py-6" ref={scrollAreaRootRef}>
          {isLoadingMessages ? (
            <div className="flex flex-col justify-center items-center h-full space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                <p className="text-xs text-muted-foreground">Syncing conversation...</p>
            </div>
          ) : messages.length === 0 && !isAiTyping ? (
             <div className="flex flex-col justify-center items-center h-full text-center space-y-4 px-6 mt-10">
                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 animate-in fade-in zoom-in duration-500">
                  <MessageSquareText className="h-10 w-10 text-primary mb-2 mx-auto" />
                  <h3 className="text-sm font-semibold text-foreground">Start a conversation!</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">Send a message to begin your collaboration.</p>
                </div>
             </div>
          ) : (
            <div className="space-y-6">
              {messages.map((msg, index) => {
                const isUser = msg.senderId === currentUser.uid;
                const isAi = msg.senderType === 'ai';
                
                return (
                  <div
                    key={msg.id || `msg-${index}`}
                    className={cn(
                      "flex items-start gap-2.5 group animate-in slide-in-from-bottom-2 duration-300",
                      isUser ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    {!isUser && (
                      <Avatar className="h-8 w-8 mt-1 border shadow-sm flex-shrink-0">
                        <AvatarImage src={isAi ? "/default-image.png" : otherUser.photoURL || undefined} />
                        <AvatarFallback className={isAi ? "bg-background text-foreground" : "bg-primary/10 text-primary"}>
                          {isAi ? <Bot className="h-4 w-4" /> : otherUser.displayName?.charAt(0) || ADMIN_FALLBACK_AVATAR_INITIAL}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    
                    <div className={cn("flex flex-col space-y-1 max-w-[75%]", isUser ? "items-end" : "items-start")}>
                      <div
                        className={cn(
                          "relative px-3 py-2 rounded-lg text-sm shadow-sm transition-all",
                          isUser 
                            ? "bg-primary text-primary-foreground rounded-br-none" 
                            : "bg-secondary text-secondary-foreground rounded-bl-none border border-border/40"
                        )}
                      >
                        {msg.text && (
                          <div 
                            className="whitespace-pre-wrap leading-relaxed" 
                            dangerouslySetInnerHTML={{ __html: linkify(msg.text) }} 
                          />
                        )}
                      </div>
                      
                      <div className={cn("flex items-center space-x-1 px-1", isUser ? "flex-row-reverse" : "flex-row")}>
                        <p className="text-[10px] font-medium text-muted-foreground/60">
                          {(() => {
                          const millis = getTimestampMillis(msg.timestamp);
                          return millis ? new Date(millis).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                        })()}
                        </p>
                        {isUser && (
                          <div className="ml-1">
                            {msg.isReadByAdmin || msg.isReadByUser ? (
                              <CheckCheck className="h-3 w-3 text-blue-500" />
                            ) : (
                              <Check className="h-3 w-3 text-muted-foreground/40" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {isAiTyping && (
                <div className="flex items-start gap-2.5 animate-in fade-in duration-300">
                  <Avatar className="h-8 w-8 mt-1 border shadow-sm flex-shrink-0 ring-1 ring-border">
                    <AvatarFallback className="bg-background text-foreground">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-secondary text-secondary-foreground border border-border/40 rounded-lg rounded-bl-none px-3 py-2.5 shadow-sm">
                    <div className="flex items-center space-x-1.5">
                      <span className="h-1.5 w-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="h-1.5 w-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="h-1.5 w-1.5 bg-muted-foreground/60 rounded-full animate-bounce"></span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>

      <CardFooter className="p-4 border-t bg-background">
        <form onSubmit={handleSendMessage} className="flex w-full items-center gap-3">
          <div className="relative flex-grow group">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message here..."
              className="w-full pr-10 py-6 rounded-2xl bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary/30 transition-all text-sm h-12"
              autoComplete="off"
              disabled={isLoadingMessages || isLoadingGlobalSettings || isLoadingOtherUser || !otherUser.uid || isAiTyping}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 group-focus-within:opacity-100 transition-opacity">
              <MessageSquareText className="h-4 w-4" />
            </div>
          </div>
          <Button 
            type="submit" 
            size="icon" 
            className={cn(
              "h-12 w-12 rounded-2xl shadow-lg transition-all duration-200 active:scale-95",
              !newMessage.trim() || isAiTyping ? "opacity-50" : "hover:bg-primary/90"
            )} 
            disabled={!newMessage.trim() || isLoadingMessages || isLoadingGlobalSettings || isLoadingOtherUser || !otherUser.uid || isAiTyping}
          >
            {isAiTyping ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5 ml-0.5" />
            )}
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}

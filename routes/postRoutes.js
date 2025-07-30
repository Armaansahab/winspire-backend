const express = require('express');
const { Post } = require('../models/databaseModels');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

module.exports = (io) => {
  router.get('/posts/:platform', authenticateToken, async (req, res) => {
    try {
      const { platform } = req.params;
      
      if (req.user.platform !== platform) {
        return res.status(403).json({ message: 'Access denied: Platform mismatch' });
      }
      
      const posts = await Post.find({ platform })
        .populate('author', 'username fullName profilePicture')
        .populate('comments.user', 'username fullName')
        .sort({ createdAt: -1 })
        .limit(20);

      console.log(`Fetched ${posts.length} posts for platform: ${platform}`);
      res.json(posts);
    } catch (error) {
      console.error('Error fetching posts:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  router.post('/posts', authenticateToken, async (req, res) => {
    try {
      const { content, platform, image } = req.body;
      
      console.log('Creating post with data:', {
        content: content || 'No content',
        platform,
        imagePresent: !!image,
        imageLength: image ? image.length : 0,
        userId: req.user.userId
      });
      
      if (req.user.platform !== platform) {
        return res.status(403).json({ message: 'Access denied: Platform mismatch' });
      }
      
      if (image && !image.startsWith('data:image/')) {
        return res.status(400).json({ message: 'Invalid image format. Must be base64 data URL.' });
      }
      
      const post = new Post({
        content: content || '',
        author: req.user.userId,
        platform,
        image: image || ''
      });

      await post.save();
      
      console.log('Post saved successfully with image length:', post.image.length);
      
      await post.populate('author', 'username fullName profilePicture');

      console.log(`New ${platform} post created by ${req.user.username}:`, post._id);
      
      io.to(platform).emit('newPost', post);

      res.status(201).json(post);
    } catch (error) {
      console.error('Error creating post:', error);
      if (error.name === 'ValidationError') {
        return res.status(400).json({ message: 'Validation error', details: error.message });
      }
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  router.post('/posts/:id/like', authenticateToken, async (req, res) => {
    try {
      const post = await Post.findById(req.params.id);
      if (!post) {
        return res.status(404).json({ message: 'Post not found' });
      }

      if (req.user.platform !== post.platform) {
        return res.status(403).json({ message: 'Access denied: Platform mismatch' });
      }

      const userId = req.user.userId;
      const userIdString = userId.toString();
      
      const likeIndex = post.likes.findIndex(id => id.toString() === userIdString);
      
      if (likeIndex > -1) {
        post.likes.splice(likeIndex, 1);
      } else {
        post.likes.push(userId);
      }

      await post.save();
      
      io.to(post.platform).emit('postLiked', { 
        postId: post._id, 
        likes: post.likes 
      });

      res.json({ 
        likes: post.likes.length, 
        isLiked: likeIndex === -1 
      });
    } catch (error) {
      console.error('Error liking post:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  router.post('/posts/:id/comment', authenticateToken, async (req, res) => {
    try {
      const { text } = req.body;
      const post = await Post.findById(req.params.id);
      
      if (!post) {
        return res.status(404).json({ message: 'Post not found' });
      }

      if (req.user.platform !== post.platform) {
        return res.status(403).json({ message: 'Access denied: Platform mismatch' });
      }

      const comment = {
        user: req.user.userId,
        text,
        createdAt: new Date()
      };

      post.comments.push(comment);
      await post.save();
      
      await post.populate({
        path: 'comments.user',
        select: 'username fullName'
      });
      
      const newComment = post.comments[post.comments.length - 1];
      
      io.to(post.platform).emit('newComment', { 
        postId: post._id, 
        comment: {
          _id: newComment._id,
          user: newComment.user,
          text: newComment.text,
          createdAt: newComment.createdAt
        }
      });

      res.status(201).json(newComment);
    } catch (error) {
      console.error('Error creating comment:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  return router;
};
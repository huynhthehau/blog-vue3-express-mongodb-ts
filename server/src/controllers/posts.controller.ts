import { NextFunction, Request, Response } from 'express'
import { CreateCommentDto } from '../dtos/comment.dto'
import { UpdatePostDto } from '../dtos/post.dto'
import { RequestWithUser } from '../interfaces/auth.interface'
import { Comment } from '../interfaces/comment.interface'
import { Post, RequestWithPost } from '../interfaces/posts.interface'
import { User } from '../interfaces/users.interface'
import { PostModel } from '../models/posts.model'
import BookmarkService from '../services/bookmarks.service'
import CommentService from '../services/comment.service'
import PostsService from '../services/posts.service'
import Post_tagService from '../services/post_tag.service'
import UsersService from '../services/users.service'
export class PostsController {
    public postService = new PostsService
    public commentService = new CommentService
    public userService = new UsersService
    public postTagService = new Post_tagService
    public bookmarkService = new BookmarkService

    public comment = async (req: RequestWithUser, res: Response, next: NextFunction) => {
        try {
            const userId = req.user._id
            let postId:any = req.params.id
            if(req.body.inReplyToComment){
                const CommentData: CreateCommentDto = { ...req.body, userId: userId }
                const createComment: Comment = await this.commentService.commentReplyComment(CommentData)
                res.status(201).json({ comment: createComment, message: "comment reply comment" })
            }else{
                const CommentData: CreateCommentDto = { ...req.body, postId: postId, userId: userId }
                const createComment: Comment = await this.commentService.comment(CommentData)
                res.status(201).json({ comment: createComment, message: "comment post" })
            }
        } catch (error) {
            next(error)
        }
    }

    public test = async (req: RequestWithUser, res: Response, next: NextFunction) => {
        try {
            const allPosts = await PostModel.aggregate([
                { $match: { status: true } },
                {
                    $lookup: {
                        from: "bookmarks",
                        localField: "_id",
                        foreignField: "postId",
                        as: "bookmarks"
                    },
                },
                {
                    $lookup: {
                        from: "view_posts",
                        localField: "_id",
                        foreignField: "postId",
                        as: "views"
                    },
                },
                {
                    $lookup: {
                        from: "vote_posts",
                        localField: "_id",
                        foreignField: "postId",
                        as: "votes"
                    },
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "userId",
                        foreignField: "_id",
                        as: "user"
                    }
                }
                , {
                    $lookup: {
                        from: "post_tags",
                        localField: "_id",
                        foreignField: "postId",
                        pipeline: [
                            { $limit: 6 }
                        ],
                        as: "tags"
                    }
                },
                {
                    $lookup: {
                        from: "tags",
                        localField: "tags.tagId",
                        foreignField: "_id",
                        as: "tags"
                    }
                },
                {
                    $project: {
                        user: { password: 0 }
                    }
                }
                , {
                    $project: {
                        _id: 1,
                        title: 1,
                        content: 1,
                        status: 1,
                        bookmarks: { $size: "$bookmarks" },
                        views: { $size: "$views" },
                        votes: {
                            $sum: {
                                $cond: {
                                    if: { $eq: ["$votes.type", "Upvote"] },
                                    then: 1,
                                    else: {
                                        if: { $eq: ["$votes.type", "Downvote"] },
                                        then: -1,
                                        else: 0
                                    }
                                }
                            }
                        },
                        user: { $arrayElemAt: ["$user", 0] },
                        // tags: "$tags.title"
                        tags: {
                            _id: 1,
                            title: 1
                        },
                    }
                }
            ])
            res.status(200).json({ allPosts })
        } catch (error) {
            next(error)
        }
    }

    public getCommentsOfPost = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const postId = req.params.id
            const { limit = 5, page = 1 } = req.query;
            let pagination: any = {
                skip: (+page - 1) * +limit,
                take: +limit
            };
            const commentOfPost: Comment[] = await this.commentService.findCommentsOfPost(postId, pagination)
            const total: Number = await this.commentService.totalCommentOfPost(postId)
            const count = commentOfPost.length
            const total_pages = Math.floor(+total % +limit == 0 ? +total / +limit : +total / +limit + 1)
            pagination = {
                total: +total,
                count: +count,
                per_page: +limit,
                current_page: +page,
                total_pages: +total_pages
            }
            res.status(200).json({ data: { count: count, comments: commentOfPost, pagination }, message: "get comments" })

        } catch (error) {
            next(error)
        }
    }

    public getBookmarksOfPost = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const postId: string = req.params.id

            const findBookmarksOfPost = await this.bookmarkService.findBookmarksOfPost(postId)

            const total = findBookmarksOfPost.length

            return res.status(200).json({ total: total, Bookmark: findBookmarksOfPost })
        } catch (error) {
            next(error)
        }
    }

    public getAllPosts = async (req: RequestWithPost, res: Response, next: NextFunction) => {
        try {
            const { limit = 10, page = 1, search = null, sort = "" } = req.query;
            //sort "","newest","trending"
            let curr: {} = {}
            if (sort == "newest") { curr = { created_at: -1 } }

            let pagination: any = {
                skip: (+page - 1) * +limit,
                take: +limit,
                search: search && { $text: { $search: `"${search}"` } },
                sort: curr
            };
            console.log(pagination)
            const { posts, total } = await this.postService.findAllPosts(pagination);
            const count = posts.length
            const total_pages = Math.floor(+total % +limit == 0 ? +total / +limit : +total / +limit + 1)
            pagination = {
                count: +count,
                total: +total,
                per_page: +limit,
                current_page: +page,
                total_pages: +total_pages
            }

            res.status(200).json({ count: count, posts: posts, pagination })

        } catch (error) {
            next(error)
        }
    }

    public getPostById = async (req: RequestWithPost, res: Response, next: NextFunction) => {
        try {
            const id: string = req.params.id
            let post: Post = await this.postService.findPostById(id);

            // const countBookmark = await this.bookmarkService.countBookmarksOfPost(id)

            // const { data, count: total } = await this.postTagService.findPost_Tag(id)
            // const count = data.length
            // const tags = data.map(e => e.tagId)
            // const total_pageTags = Math.floor(+total % 5 == 0 ? +total / 5 : +total / 5 + 1)
            // const tagPagination = {
            //     count: +count,
            //     total: +total,
            //     per_page: 5,
            //     current_page: 1,
            //     total_pages: +total_pageTags
            // }
            // const tagData = { data: tags, meta: tagPagination }

            // const data2 = { ...post['_doc'], user: post['user'], countBookmark: countBookmark, tags: tagData }

            res.status(200).json({ post: post, message: "get post by id" })
        } catch (error) {
            next(error)
        }
    }

    public createPost = async (req: RequestWithUser, res: Response, next: NextFunction) => {
        try {
            const user: User = req.user
            const postCreateData = req.body
            const postCreated: any = await this.postService.createPost(postCreateData, user._id)
            const data = { ...postCreated['_doc'], user: user }
            res.status(201).json({ data: data, message: "created" })
        } catch (error) {
            next(error)
        }
    }

    public updatePost = async (req: RequestWithPost, res: Response, next: NextFunction) => {
        try {
            const id = req.params.id;
            const postUpdateData: UpdatePostDto = req.body
            const postUpdated: Post = await this.postService.updatePost(postUpdateData, id)
            res.status(200).json({ data: postUpdated, message: "updated" })
        } catch (error) {
            next(error)
        }
    }

    public deletePost = async (req: RequestWithPost, res: Response, next: NextFunction) => {
        try {
            const id = req.params.id
            await this.postService.deletePost(id)
            res.status(200).json({ message: "deleted" })
        } catch (error) {
            next(error)
        }
    }

}
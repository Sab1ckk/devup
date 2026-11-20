import argparse,getpass
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.db import SessionLocal
from app.models import ProjectRequest,RequestStatusHistory,STATUSES
from app.cleanup import cleanup
from app.admin_cli import create_manager,reset_manager_password

def main():
    parser=argparse.ArgumentParser();commands=parser.add_subparsers(dest='command',required=True)
    status=commands.add_parser('set-status');status.add_argument('number',type=int);status.add_argument('status',choices=STATUSES);status.add_argument('--comment',default='')
    commands.add_parser('cleanup')
    manager=commands.add_parser('create-manager');manager.add_argument('username');manager.add_argument('email')
    reset=commands.add_parser('reset-manager-password');reset.add_argument('username')
    args=parser.parse_args()
    try:
        if args.command=='cleanup':cleanup()
        elif args.command in ('create-manager','reset-manager-password'):
            password=getpass.getpass('Пароль менеджера (от 8 символов): ')
            if args.command=='create-manager':create_manager(args.username,args.email,password)
            else:reset_manager_password(args.username,password)
        else:
            with SessionLocal.begin() as db:
                p=db.scalar(select(ProjectRequest).where(ProjectRequest.number==args.number).with_for_update())
                if not p:parser.error('Заявка не найдена')
                db.add(RequestStatusHistory(request_id=p.id,from_status=p.status,to_status=args.status,comment=args.comment));p.status=args.status
    except ValueError as exc:parser.error(str(exc))
    except IntegrityError:parser.error('Логин или почта уже используются')
if __name__=='__main__':main()

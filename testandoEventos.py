from pymongo import MongoClient, ReturnDocument
from pymongo.errors import PyMongoError
from bson import ObjectId
import threading
import random
import string
import time
from datetime import datetime
# Conexão com o MongoDB mongodb://localhost:27017/
client = MongoClient("mongodb+srv://mateusmartins:132Sangue@cluster0.4jwbnum.mongodb.net/")
db = client.get_database('coeps2024')
def generate_random_username(length=8):
    # Gera uma string aleatória de letras e números
    characters = string.ascii_letters + string.digits
    username = ''.join(random.choice(characters) for _ in range(length))
    return username
def subscribe_to_event(user_id, event_id):
    session = client.start_session()
    session.start_transaction()

    try:
        event = db.events.find_one({"_id": event_id}, session=session)

        if not event:
            raise ValueError("Event not found")

        if user_id in event.get("participants", []):
            raise ValueError("Already subscribed")

        if len(event.get("participants", [])) >= event.get("maxParticipants", 0):
            raise ValueError("Event is full")

        result = db.events.find_one_and_update(
            {
                "_id": event_id,
                "participants": {"$not": {"$elemMatch": {"$eq": user_id}}},
                "$expr": {"$lt": [{"$size": "$participants"}, "$maxParticipants"]}
            },
            {
                "$push": {"participants": user_id},
                "$inc": {"participantsCount": 1}
            },
            return_document=ReturnDocument.AFTER,
            session=session
        )

        if not result:
            raise ValueError("Failed to subscribe")

        session.commit_transaction()
        return {"message": "Subscribed successfully", "event": result}

    except Exception as e:
        session.abort_transaction()
        return {"error": str(e)}

    finally:
        session.end_session()

# Função para executar a inscrição em várias threads
def thread_subscribe(user_id, event_id):
    response = subscribe_to_event(user_id, event_id)
    print(response)


def subscribe_to_event_with_retry(user_id, event_id):
    session = client.start_session()
    session.start_transaction()

    try:
        event = db.events.find_one({"_id": event_id}, session=session)

        if not event:
            raise ValueError("Event not found")

        if user_id in event.get("participants", []):
            raise ValueError("Already subscribed")

        if len(event.get("participants", [])) >= event.get("maxParticipants", 0):
            raise ValueError("Event is full")

        for _ in range(3):  # Tenta 3 vezes antes de desistir
            try:
                result = db.events.find_one_and_update(
                    {
                        "_id": event_id,
                        "participants": {"$not": {"$elemMatch": {"$eq": user_id}}},
                        "$expr": {"$lt": [{"$size": "$participants"}, "$maxParticipants"]}
                    },
                    {
                        "$push": {"participants": user_id},
                        "$inc": {"participantsCount": 1}
                    },
                    return_document=ReturnDocument.AFTER,
                    session=session
                )

                if not result:
                    raise ValueError("Failed to subscribe")

                session.commit_transaction()
                return {"message": "Subscribed successfully", "event": result}

            except PyMongoError as e:
                session.abort_transaction()
                if isinstance(e, WriteConflictError):
                    time.sleep(random.uniform(0.1, 0.5))  # Espera aleatória
                    session.start_transaction()
                    continue
                else:
                    return {"error": str(e)}

    except Exception as e:
        session.abort_transaction()
        return {"error": str(e)}

    finally:
        session.end_session()
def subscribe_to_event02(user_id, event_id):
    # Gera um número inteiro aleatório entre 0 e 1
    inteiro_aleatorio = random.randint(0, 1)

    # Adiciona uma fração de segundo
    numero_aleatorio = inteiro_aleatorio + random.uniform(0, 1)
    #
    #
    #print(numero_aleatorio)
    time.sleep(numero_aleatorio)
    try:
        result = db.events.find_one_and_update(
            {
                "_id": event_id,
                "participants": {"$not": {"$elemMatch": {"$eq": user_id}}},
                "$expr": {"$lt": [{"$size": "$participants"}, "$maxParticipants"]}
            },
            {
                "$push": {"participants": user_id},
                "$inc": {"participantsCount": 1}
            }
        )
        #now = datetime.now()
        #current_time = now.strftime("%H:%M:%S.%f")
        #print("Hora:", current_time)
        if not result:
            # print(result)
            raise ValueError("Failed to subscribe")
        return {"message": "Subscribed successfully"}

    except Exception as e:

        return {"error": str(e)}

    finally:
        return 0

    return {"error": "Max retries exceeded"}


# Número de threads que você deseja iniciar
num_threads = 15000
user_id = "user123"
event_id = ObjectId("6692fb8629c777824717505f")

# Criar e iniciar as threads
threads = []
start_barrier = threading.Barrier(num_threads)
for _ in range(num_threads):
    username = generate_random_username()
    thread = threading.Thread(target=subscribe_to_event02, args=(username, event_id))
    threads.append(thread)
    thread.start()
    """
    thread = threading.Thread(target=subscribe_to_event02, args=(generate_random_username(), event_id))
    threads.append(thread)
    thread.start()
    """

# Esperar todas as threads terminarem
for thread in threads:
    thread.join()
